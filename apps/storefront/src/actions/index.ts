import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { addItem, applyPromo, getCartView, removeItem, removePromo, setSubscription, updateQty } from '~/lib/cart';
import { placeOrder, restrictedLines, updateCheckout, validateAddress } from '~/lib/checkout';
import { deleteAddress, updateProfile } from '~/lib/account';
import { addShipment, ORDER_STATUSES, updateOrderStatus, updateSetting } from '~/lib/admin';
import { getAuth } from '~/lib/auth';
import { changeOwnPassword, MANAGER_COOKIE } from '~/lib/manager-auth';
import { staffActions } from './manager/staff';
import { productActions } from './manager/products';
import { catalogActions } from './manager/catalog';
import { imageActions } from './manager/images';
import { orderActions } from './manager/orders';
import { customerActions } from './manager/customers';
import { configActions } from './manager/config';
import { marketingActions } from './manager/marketing';
import { supportActions } from './manager/support';
import { requireArea } from '~/lib/manager/permissions';
import { orderItems, orders } from '@ff/db';
import { eq } from 'drizzle-orm';
import { getDb } from '~/lib/db';
import { getProviders } from '~/lib/providers';
import { sendOrderConfirmation, sendShipmentNotice } from '~/lib/emails';

/**
 * Astro's form parser turns an empty input into `null` (or `undefined` for `.optional()`), so a
 * blank required field must be accepted here and reported by `validateAddress` with a friendly
 * message instead of failing schema validation with a raw zod dump. The hidden billing block
 * posts every field empty when "same as shipping" is ticked.
 */
const field = (max: number) => z.string().trim().max(max).nullish().transform((v) => v ?? '');
const optionalField = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || undefined);
const addressSchema = z.object({
  firstName: field(60),
  lastName: field(60),
  company: optionalField(80),
  line1: field(120),
  line2: optionalField(120),
  city: field(80),
  region: field(3),
  postalCode: field(12),
  country: z.string().trim().length(2).nullish().transform((v) => v || 'US'),
  phone: optionalField(30),
});

function bad(message: string, fields?: Record<string, string>): never {
  throw new ActionError({ code: 'BAD_REQUEST', message: fields ? JSON.stringify({ message, fields }) : message });
}

/**
 * Back-office actions can be posted to any URL, so each one re-checks for a manager session.
 * Middleware only sets `locals.admin` on /manager routes; a customer session never qualifies.
 */
function requireAdmin(ctx: { locals: App.Locals }) {
  const admin = ctx.locals.admin;
  if (!admin) throw new ActionError({ code: 'FORBIDDEN', message: 'Manager sign-in required' });
  return admin;
}

/**
 * Server actions. All accept plain form posts so the site works without
 * client JavaScript; React islands call the same actions for a faster UX.
 */
export const server = {
  cart: {
    add: defineAction({
      accept: 'form',
      input: z.object({
        productId: z.number().int().positive(),
        qty: z.number().int().min(1).max(99).default(1),
        optionId: z.number().int().positive().optional(),
        subscriptionMonths: z.number().int().min(1).max(12).optional(),
      }),
      handler: async (input, ctx) => {
        try {
          return await addItem(ctx.session, {
            productId: input.productId,
            qty: input.qty,
            optionId: input.optionId ?? null,
            subscriptionMonths: input.subscriptionMonths ?? null,
          });
        } catch (e) {
          throw new ActionError({ code: 'BAD_REQUEST', message: e instanceof Error ? e.message : 'Could not add item' });
        }
      },
    }),

    updateQty: defineAction({
      accept: 'form',
      input: z.object({ itemId: z.number().int().positive(), qty: z.number().int().min(0).max(99) }),
      handler: async ({ itemId, qty }, ctx) => {
        await updateQty(ctx.session, itemId, qty);
        return { ok: true };
      },
    }),

    remove: defineAction({
      accept: 'form',
      input: z.object({ itemId: z.number().int().positive() }),
      handler: async ({ itemId }, ctx) => {
        await removeItem(ctx.session, itemId);
        return { ok: true };
      },
    }),

    applyPromo: defineAction({
      accept: 'form',
      input: z.object({ code: z.string().trim().min(1).max(40) }),
      handler: async ({ code }, ctx) => {
        const r = await applyPromo(ctx.session, code);
        if (!r.ok) throw new ActionError({ code: 'BAD_REQUEST', message: r.message });
        return r;
      },
    }),

    removePromo: defineAction({
      accept: 'form',
      input: z.object({ code: z.string().trim().min(1).max(40) }),
      handler: async ({ code }, ctx) => {
        await removePromo(ctx.session, code);
        return { ok: true };
      },
    }),

    /** Adds every line of a past order back to the cart (legacy "Re-Order Now"). */
    reorder: defineAction({
      accept: 'form',
      input: z.object({ orderId: z.number().int().positive() }),
      handler: async ({ orderId }, ctx) => {
        const user = ctx.locals.user;
        const db = getDb();
        const order = await db.query.orders.findFirst({ columns: { id: true, email: true, customerId: true }, where: eq(orders.id, orderId) });
        if (!order) throw new ActionError({ code: 'NOT_FOUND', message: 'Order not found' });
        const owns = user ? order.customerId === user.customerId || order.email.toLowerCase() === user.email.toLowerCase() : false;
        if (!owns) throw new ActionError({ code: 'FORBIDDEN', message: 'Sign in to reorder this order' });
        const items = await db.select({ productId: orderItems.productId, qty: orderItems.qty, subscriptionMonths: orderItems.subscriptionMonths }).from(orderItems).where(eq(orderItems.orderId, orderId));
        let added = 0;
        let skipped = 0;
        for (const i of items) {
          if (!i.productId) continue;
          try {
            await addItem(ctx.session, { productId: i.productId, qty: i.qty, subscriptionMonths: i.subscriptionMonths });
            added++;
          } catch {
            skipped++;
          }
        }
        if (!added) throw new ActionError({ code: 'BAD_REQUEST', message: 'None of the items in this order are available right now.' });
        return { added, skipped };
      },
    }),

    setSubscription: defineAction({
      accept: 'form',
      input: z.object({ itemId: z.number().int().positive(), months: z.number().int().min(0).max(12) }),
      handler: async ({ itemId, months }, ctx) => {
        await setSubscription(ctx.session, itemId, months === 0 ? null : months);
        return { ok: true };
      },
    }),
  },

  account: {
    deleteAddress: defineAction({
      accept: 'form',
      input: z.object({ addressId: z.number().int().positive() }),
      handler: async ({ addressId }, ctx) => {
        const user = ctx.locals.user;
        if (!user?.customerId) throw new ActionError({ code: 'UNAUTHORIZED', message: 'Sign in first' });
        await deleteAddress(user.customerId, addressId);
        return { ok: true };
      },
    }),

    updateProfile: defineAction({
      accept: 'form',
      input: z.object({
        firstName: z.string().trim().max(60).optional(),
        lastName: z.string().trim().max(60).optional(),
        phone: z.string().trim().max(30).optional(),
        newsletter: z.boolean().optional(),
        smsOptIn: z.boolean().optional(),
      }),
      handler: async (input, ctx) => {
        const user = ctx.locals.user;
        if (!user?.customerId) throw new ActionError({ code: 'UNAUTHORIZED', message: 'Sign in first' });
        await updateProfile(user.customerId, { firstName: input.firstName, lastName: input.lastName, phone: input.phone, newsletter: Boolean(input.newsletter), smsOptIn: Boolean(input.smsOptIn) });
        return { ok: true };
      },
    }),

    changePassword: defineAction({
      accept: 'form',
      input: z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(7).max(200) }),
      handler: async ({ currentPassword, newPassword }, ctx) => {
        if (!ctx.locals.user) throw new ActionError({ code: 'UNAUTHORIZED', message: 'Sign in first' });
        try {
          await getAuth().api.changePassword({ body: { currentPassword, newPassword, revokeOtherSessions: false }, headers: ctx.request.headers });
        } catch {
          throw new ActionError({ code: 'BAD_REQUEST', message: 'Current password is incorrect.' });
        }
        return { ok: true };
      },
    }),
  },

  manager: {
    updateOrderStatus: defineAction({
      accept: 'form',
      input: z.object({ orderId: z.number().int().positive(), status: z.enum(ORDER_STATUSES) }),
      handler: async ({ orderId, status }, ctx) => {
        requireArea(ctx, 'Orders', 1);
        await updateOrderStatus(orderId, status);
        return { ok: true };
      },
    }),

    addShipment: defineAction({
      accept: 'form',
      input: z.object({ orderId: z.number().int().positive(), carrier: z.string().trim().min(1).max(40), trackingNumber: z.string().trim().min(4).max(60), notify: z.boolean().default(false) }),
      handler: async ({ orderId, carrier, trackingNumber, notify }, ctx) => {
        requireArea(ctx, 'Orders', 1);
        const r = await addShipment(orderId, carrier, trackingNumber, notify);
        return { ok: true, emailed: r.email?.ok ?? false, emailError: r.email && !r.email.ok ? (r.email.error ?? 'send failed') : null };
      },
    }),

    /** Re-sends the order confirmation (or the latest shipment notice) to the order's email address. */
    resendOrderEmail: defineAction({
      accept: 'form',
      input: z.object({ orderId: z.number().int().positive(), kind: z.enum(['order-confirmation', 'shipment']) }),
      handler: async ({ orderId, kind }, ctx) => {
        requireArea(ctx, 'Orders', 1);
        const r = kind === 'shipment' ? await sendShipmentNotice(orderId) : await sendOrderConfirmation(orderId);
        if (!r.ok) throw new ActionError({ code: 'BAD_REQUEST', message: `Email not sent: ${r.error ?? 'unknown error'}` });
        return { ok: true, kind };
      },
    }),

    ...staffActions,
    ...productActions,
    ...catalogActions,
    ...imageActions,
    ...orderActions,
    ...customerActions,
    ...configActions,
    ...marketingActions,
    ...supportActions,

    changePassword: defineAction({
      accept: 'form',
      input: z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(1).max(200), confirm: z.string().min(1).max(200) }),
      handler: async ({ currentPassword, newPassword, confirm }, ctx) => {
        const me = requireAdmin(ctx);
        if (newPassword !== confirm) throw new ActionError({ code: 'BAD_REQUEST', message: 'The new passwords do not match.' });
        const r = await changeOwnPassword(me.id, currentPassword, newPassword, ctx.cookies.get(MANAGER_COOKIE)?.value);
        if (!r.ok) throw new ActionError({ code: 'BAD_REQUEST', message: r.message });
        return { ok: true };
      },
    }),

    updateSetting: defineAction({
      accept: 'form',
      input: z.object({ key: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9_.-]+$/), value: z.string().max(20000) }),
      handler: async ({ key, value }, ctx) => {
        requireArea(ctx, 'Setup', 1);
        try {
          await updateSetting(key, value.trim());
        } catch {
          throw new ActionError({ code: 'BAD_REQUEST', message: `"${key}" was not saved: the value must be valid JSON (wrap text in double quotes).` });
        }
        return { ok: true, key };
      },
    }),
  },

  checkout: {
    /** Step 1: contact + shipping (+ optional billing) address. */
    saveAddresses: defineAction({
      accept: 'form',
      input: z.object({
        email: z.string().trim().toLowerCase().max(120).default(''),
        smsOptIn: z.boolean().optional(),
        newsletter: z.boolean().optional(),
        billingSame: z.boolean().optional(),
        shipping: addressSchema,
        billing: addressSchema.optional(),
      }),
      handler: async (input, ctx) => {
        const fields: Record<string, string> = {};
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) fields.email = 'Enter a valid email address';
        Object.assign(fields, validateAddress(input.shipping, 'shipping.'));
        const billingSame = input.billingSame !== false;
        if (!billingSame && input.billing) Object.assign(fields, validateAddress(input.billing, 'billing.'));
        if (Object.keys(fields).length) bad('Please fix the highlighted fields', fields);

        const shipping = { ...input.shipping, region: input.shipping.region.toUpperCase(), email: input.email };
        const check = await getProviders().address.validate(shipping);
        if (!check.valid) bad(check.messages.join(' ') || 'Address could not be verified', { 'shipping.line1': 'Check this address' });
        const blocked = await restrictedLines((await getCartView(ctx.session)).lines, shipping);
        if (blocked.length) bad(`Sorry, these items can't be shipped to ${shipping.region || shipping.country}: ${blocked.join(', ')}. Remove them from your cart or choose another address.`, { 'shipping.region': 'Not available for this item' });

        await updateCheckout(ctx.session, {
          email: input.email,
          shipping,
          billingSameAsShipping: billingSame,
          billing: billingSame ? undefined : input.billing ? { ...input.billing, region: input.billing.region.toUpperCase() } : undefined,
          smsOptIn: Boolean(input.smsOptIn),
          newsletter: Boolean(input.newsletter),
          shippingRateId: undefined, // rates depend on the address
        });
        return { ok: true, classification: check.classification };
      },
    }),

    /** Step 2: shipping method. */
    selectShipping: defineAction({
      accept: 'form',
      input: z.object({ rateId: z.string().min(1).max(40) }),
      handler: async ({ rateId }, ctx) => {
        await updateCheckout(ctx.session, { shippingRateId: rateId });
        return { ok: true };
      },
    }),

    /** Step 3: donation choice (none | roundup | cents). */
    setDonation: defineAction({
      accept: 'form',
      input: z.object({ donation: z.string().max(10).default('none'), customCents: z.number().int().min(0).max(10000).optional() }),
      handler: async ({ donation, customCents }, ctx) => {
        const value = donation === 'custom' ? String(customCents ?? 0) : donation;
        await updateCheckout(ctx.session, { donation: value });
        return { ok: true };
      },
    }),

    /** Step 4: pay and place the order. */
    placeOrder: defineAction({
      accept: 'form',
      input: z.object({
        method: z.enum(['card', 'paypal', 'applepay', 'googlepay']).default('card'),
        paymentToken: z.string().min(1).max(4000),
      }),
      handler: async (input, ctx) => {
        try {
          return await placeOrder(ctx.session, {
            method: input.method,
            paymentToken: input.paymentToken,
            ip: ctx.request.headers.get('cf-connecting-ip') ?? undefined,
            customerId: ctx.locals.user?.customerId ?? null,
          });
        } catch (e) {
          throw new ActionError({ code: 'BAD_REQUEST', message: e instanceof Error ? e.message : 'Could not place the order' });
        }
      },
    }),
  },
};
