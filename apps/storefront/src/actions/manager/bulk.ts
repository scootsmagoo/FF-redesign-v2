import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { applyBulk, BulkError, bulkOpFrom, parseIds } from '~/lib/manager/bulk';
import { requireArea } from '~/lib/manager/permissions';

export const bulkActions = {
  /** Applies a previewed bulk operation (legacy sa_prod_bulk "execute", without the raw SQL). */
  applyBulkUpdate: defineAction({
    accept: 'form',
    input: z.object({ ids: z.string().max(50000), kind: z.string().max(20), find: z.string().max(2000).nullish(), replace: z.string().max(2000).nullish(), fields: z.array(z.string()).default([]), imageUrl: z.string().max(500).nullish(), thumbUrl: z.string().max(500).nullish(), parentId: z.string().max(12).nullish(), active: z.string().max(5).nullish() }),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Products', 1);
      try {
        const op = bulkOpFrom(input);
        return { ok: true, updated: await applyBulk(parseIds(input.ids), op) };
      } catch (e) {
        throw new ActionError({ code: 'BAD_REQUEST', message: e instanceof BulkError ? e.message : 'The bulk update failed.' });
      }
    },
  }),
};
