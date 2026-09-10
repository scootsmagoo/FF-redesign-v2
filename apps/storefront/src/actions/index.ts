import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { addItem, applyPromo, removeItem, removePromo, setSubscription, updateQty } from '~/lib/cart';
import { placeOrder, updateCheckout, validateAddress } from '~/lib/checkout';
import { deleteAddress, updateProfile } from '~/lib/account';
import { getAuth } from '~/lib/auth';
import { orderItems, orders } from '@ff/db';
import { eq } from 'drizzle-orm';
import { getDb } from '~/lib/db';
import { getProviders } from '~/lib/providers';

const addressSchema = z.object({
  firstName: z.string().trim().max(60).default(''),
  lastName: z.string().trim().max(60).default(''),
  company: z.string().trim().max(80).optional(),
  line1: z.string().trim().max(120).default(''),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).default(''),
  region: z.string().trim().max(3).default(''),
  postalCode: z.string().trim().max(12).default(''),
  country: z.string().trim().length(2).default('US'),
  phone: z.string().trim().max(30).optional(),
});

function bad(message: string, fields?: Record<string, string>): never {
  throw new ActionError({ code: 'BAD_REQUEST', message: fields ? JSON.stringify({ message, fields }) : message });
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
