import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { requireArea } from '~/lib/manager/permissions';
import { emailSxsExport, SxsError } from '~/lib/manager/sxs';

const ids = (v: unknown) =>
  String(v ?? '')
    .split(/[^0-9]+/)
    .map(Number)
    .filter((n) => n > 0);

export const sxsActions = {
  /** Emails the SxS export CSV to a staff address (legacy SA_SxSExport "email" action). */
  emailSxsExport: defineAction({
    accept: 'form',
    input: z.object({ to: z.string().max(200), roots: z.string().max(2000).nullish(), includeInactive: z.boolean().default(false), onlyWithChildren: z.boolean().default(false) }),
    handler: async (input, ctx) => {
      const admin = requireArea(ctx, 'Products', 1);
      try {
        return { ok: true, ...(await emailSxsExport(input.to, { rootIds: ids(input.roots), includeInactive: input.includeInactive, onlyWithChildren: input.onlyWithChildren }, admin.email)) };
      } catch (e) {
        throw new ActionError({ code: 'BAD_REQUEST', message: e instanceof SxsError ? e.message : 'The export could not be emailed.' });
      }
    },
  }),
};
