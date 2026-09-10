import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { addItem, removeItem, setSubscription, updateQty } from '~/lib/cart';

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

    setSubscription: defineAction({
      accept: 'form',
      input: z.object({ itemId: z.number().int().positive(), months: z.number().int().min(0).max(12) }),
      handler: async ({ itemId, months }, ctx) => {
        await setSubscription(ctx.session, itemId, months === 0 ? null : months);
        return { ok: true };
      },
    }),
  },
};
