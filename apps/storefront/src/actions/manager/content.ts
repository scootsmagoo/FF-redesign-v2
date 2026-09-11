import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { ConfigError, saveDonationSettings, saveFundraiser, saveSiteGraphics, type Fundraiser } from '~/lib/manager/config';
import { dbWriteTest, HealthError, sendTestEmail } from '~/lib/manager/health';
import { requireArea } from '~/lib/manager/permissions';
import { nullIfBlank, toBool } from '~/lib/manager/util';

const fail = (e: unknown): never => {
  throw new ActionError({ code: 'BAD_REQUEST', message: e instanceof ConfigError || e instanceof HealthError ? e.message : 'Something went wrong' });
};
const strs = z.array(z.string()).default([]);

/** Site content settings + health utilities (legacy edit_graphics, Edit_donate_text, Edit_fund, utilities_*). All Setup = 1. */
export const contentActions = {
  saveSiteGraphics: defineAction({
    accept: 'form',
    input: z.object({ location: strs, defaultUrl: strs, specialUrl: strs, startsAt: strs, endsAt: strs, force: strs }),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Setup', 1);
      // `force` is a checkbox per row: its value is the row index so unchecked rows can be told apart.
      const forced = new Set(input.force.map(Number));
      const rows = input.location.map((location, i) => ({ location, defaultUrl: input.defaultUrl[i] ?? '', specialUrl: input.specialUrl[i] ?? '', startsAt: nullIfBlank(input.startsAt[i]), endsAt: nullIfBlank(input.endsAt[i]), force: forced.has(i) }));
      try {
        await saveSiteGraphics(rows);
        return { ok: true };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  saveDonationSettings: defineAction({
    accept: 'form',
    input: z.object({ enabled: z.boolean().default(false), charityName: z.string().max(120), blurb: z.string().max(500).nullish(), moreHtml: z.string().max(50000).nullish() }),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Setup', 1);
      try {
        await saveDonationSettings({ enabled: input.enabled, charityName: input.charityName, blurb: input.blurb ?? '', moreHtml: input.moreHtml ?? '' });
        return { ok: true };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  saveFundraiser: defineAction({
    accept: 'form',
    input: z.object({}).catchall(z.any()),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Setup', 1);
      const f = input as Record<string, unknown>;
      const s = (k: string) => String(f[k] ?? '').trim();
      const d = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s(k)) ? s(k) : null);
      const rec: Fundraiser = { campaignId: s('campaignId'), startDate: d('startDate'), endDate: d('endDate'), requestedStart: d('requestedStart'), orgName: s('orgName'), orgAddress: s('orgAddress'), orgCity: s('orgCity'), orgState: s('orgState').toUpperCase(), orgZip: s('orgZip'), federalId: s('federalId'), contactName: s('contactName'), contactEmail: s('contactEmail'), contactPhone: s('contactPhone'), active: toBool(f.active), approved: toBool(f.approved) };
      try {
        await saveFundraiser(rec);
        return { ok: true };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  dbWriteTest: defineAction({
    accept: 'form',
    input: z.object({}),
    handler: async (_input, ctx) => {
      const admin = requireArea(ctx, 'Setup', 1);
      try {
        return await dbWriteTest(admin.email);
      } catch (e) {
        return fail(e);
      }
    },
  }),
  sendTestEmail: defineAction({
    accept: 'form',
    input: z.object({ to: z.string().email().max(200) }),
    handler: async ({ to }, ctx) => {
      const admin = requireArea(ctx, 'Setup', 1);
      try {
        return await sendTestEmail(to, admin.email);
      } catch (e) {
        return fail(e);
      }
    },
  }),
};
