import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import type { Address } from '@ff/integrations';
import { requireArea } from '~/lib/manager/permissions';
import { addOrderNote, changeOrderStatus, createReturn, editOrder, issueCredit, OrderError, purgeStaleCarts, refundReturn, transferOrderToCustomer, updateReturn, type OrderStatus } from '~/lib/manager/orders';
import { ORDER_STATUSES } from '~/lib/admin';
import { dollarsToCents, toBool, toInt } from '~/lib/manager/util';

const fail = (e: unknown): never => {
  throw new ActionError({ code: 'BAD_REQUEST', message: e instanceof Error ? e.message : 'Something went wrong' });
};

function addressFrom(f: Record<string, unknown>, prefix: string): Address {
  const s = (k: string) => String(f[`${prefix}.${k}`] ?? '').trim();
  return { firstName: s('firstName'), lastName: s('lastName'), company: s('company') || undefined, line1: s('line1'), line2: s('line2') || undefined, city: s('city'), region: s('region').toUpperCase(), postalCode: s('postalCode'), country: (s('country') || 'US').toUpperCase(), phone: s('phone') || undefined };
}

const withOrder = z.object({ orderId: z.number().int().positive() });

export const orderActions = {
  editOrder: defineAction({
    accept: 'form',
    input: withOrder.catchall(z.any()),
    handler: async (input, ctx) => {
      const admin = requireArea(ctx, 'Orders', 1);
      const f = input as Record<string, unknown>;
      try {
        await editOrder(
          input.orderId,
          {
            email: String(f.email ?? '').trim().toLowerCase(),
            billing: addressFrom(f, 'billing'),
            shipping: addressFrom(f, 'shipping'),
            shippingMethod: f.shippingMethod ? String(f.shippingMethod) : null,
            discountCents: dollarsToCents(String(f.discount ?? '')) ?? 0,
            shippingCents: dollarsToCents(String(f.shipping ?? '')) ?? 0,
            taxCents: dollarsToCents(String(f.tax ?? '')) ?? 0,
            donationCents: dollarsToCents(String(f.donation ?? '')) ?? 0,
            adjustmentCents: dollarsToCents(String(f.adjustment ?? '')) ?? 0,
            salesCode: f.salesCode ? String(f.salesCode) : null,
          },
          admin.email,
        );
      } catch (e) {
        return fail(e);
      }
      return { ok: true };
    },
  }),

  addOrderNote: defineAction({
    accept: 'form',
    input: withOrder.extend({ text: z.string().max(4000), kind: z.enum(['private', 'public']).default('private') }),
    handler: async ({ orderId, text, kind }, ctx) => {
      // level 2 (restricted) may add private notes, as on the legacy site
      const admin = requireArea(ctx, 'Orders', 0);
      if (kind === 'public') requireArea(ctx, 'Orders', 1);
      try {
        await addOrderNote(orderId, text, kind, admin.email);
      } catch (e) {
        return fail(e);
      }
      return { ok: true };
    },
  }),

  changeOrderStatus: defineAction({
    accept: 'form',
    input: withOrder.extend({ status: z.enum(ORDER_STATUSES), cancelReason: z.number().int().nullish(), notify: z.boolean().default(false), note: z.string().max(2000).nullish() }),
    handler: async ({ orderId, status, cancelReason, notify, note }, ctx) => {
      const admin = requireArea(ctx, 'Orders', 1);
      try {
        return { ok: true, ...(await changeOrderStatus(orderId, status as OrderStatus, { cancelReason: cancelReason ?? null, notify, note: note ?? null }, admin.email)) };
      } catch (e) {
        return fail(e);
      }
    },
  }),

  issueCredit: defineAction({
    accept: 'form',
    input: withOrder.extend({ amount: z.string().max(12), reason: z.string().max(40), note: z.string().max(500).nullish(), method: z.enum(['original', 'manual']).default('original'), confirmOver: z.boolean().default(false) }),
    handler: async ({ orderId, amount, reason, note, method }, ctx) => {
      const admin = requireArea(ctx, 'CreditAPI', 1);
      try {
        const r = await issueCredit(orderId, { amountCents: dollarsToCents(amount) ?? 0, reason, note: note?.trim() || null, method }, admin.email);
        if (r.status === 'failed') throw new ActionError({ code: 'BAD_REQUEST', message: `Refund failed: ${r.error}. The attempt was recorded.` });
        return { ok: true, id: r.id };
      } catch (e) {
        return fail(e);
      }
    },
  }),

  createReturn: defineAction({
    accept: 'form',
    input: withOrder.extend({ fee: z.string().max(12).nullish(), comment: z.string().max(2000).nullish(), labelTracking: z.string().max(60).nullish() }).catchall(z.any()),
    handler: async (input, ctx) => {
      const admin = requireArea(ctx, 'Returns', 1);
      const f = input as Record<string, unknown>;
      const items: { orderItemId: number; qty: number; reason: string; refundOnly: boolean }[] = [];
      for (const k of Object.keys(f)) {
        const m = /^qty-(\d+)$/.exec(k);
        if (!m) continue;
        const id = Number(m[1]);
        items.push({ orderItemId: id, qty: toInt(f[k], 0) ?? 0, reason: String(f[`reason-${id}`] ?? ''), refundOnly: toBool(f[`refundOnly-${id}`]) });
      }
      try {
        return { ok: true, id: await createReturn(input.orderId, { items, feeCents: dollarsToCents(input.fee) ?? 0, comment: input.comment?.trim() || null, labelTracking: input.labelTracking?.trim() || null }, admin.email) };
      } catch (e) {
        return fail(e);
      }
    },
  }),

  updateReturn: defineAction({
    accept: 'form',
    input: z.object({ returnId: z.number().int().positive(), status: z.string().max(20).nullish(), fee: z.string().max(12).nullish(), comment: z.string().max(2000).nullish(), labelTracking: z.string().max(60).nullish() }),
    handler: async ({ returnId, status, fee, comment, labelTracking }, ctx) => {
      const admin = requireArea(ctx, 'Returns', 1);
      try {
        await updateReturn(returnId, { status: status || undefined, feeCents: fee === null || fee === undefined ? undefined : (dollarsToCents(fee) ?? 0), comment: comment === undefined ? undefined : comment, labelTracking: labelTracking === undefined ? undefined : labelTracking }, admin.email);
      } catch (e) {
        return fail(e);
      }
      return { ok: true };
    },
  }),

  refundReturn: defineAction({
    accept: 'form',
    input: z.object({ returnId: z.number().int().positive() }),
    handler: async ({ returnId }, ctx) => {
      const admin = requireArea(ctx, 'Returns', 1);
      requireArea(ctx, 'CreditAPI', 1);
      try {
        const r = await refundReturn(returnId, admin.email);
        if (r.status === 'failed') throw new ActionError({ code: 'BAD_REQUEST', message: `Refund failed: ${r.error}` });
        return { ok: true };
      } catch (e) {
        return fail(e);
      }
    },
  }),

  transferOrder: defineAction({
    accept: 'form',
    input: withOrder.extend({ customerId: z.number().int().positive() }),
    handler: async ({ orderId, customerId }, ctx) => {
      const admin = requireArea(ctx, 'Orders', 1);
      try {
        await transferOrderToCustomer(orderId, customerId, admin.email);
      } catch (e) {
        return fail(e);
      }
      return { ok: true };
    },
  }),

  purgeCarts: defineAction({
    accept: 'form',
    input: z.object({ hours: z.number().int().min(1).max(8760) }),
    handler: async ({ hours }, ctx) => {
      requireArea(ctx, 'Orders', 1);
      return { ok: true, purged: await purgeStaleCarts(hours) };
    },
  }),
};

export type { OrderError };
