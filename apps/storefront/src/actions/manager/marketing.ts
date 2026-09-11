import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { requireArea } from '~/lib/manager/permissions';
import { deleteAffiliate, deleteNewsletter, deletePromotion, duplicatePromotion, MarketingError, saveAffiliate, saveNewsletter, savePromotion, sendNewsletterBatch, sendNewsletterPreview, setPromotionStatus, type PromotionInput } from '~/lib/manager/marketing';
import { dollarsToCents, toBool, toInt, toNum } from '~/lib/manager/util';

const fail = (e: unknown): never => {
  throw new ActionError({ code: 'BAD_REQUEST', message: e instanceof MarketingError || e instanceof Error ? e.message : 'Something went wrong' });
};
const ids = (v: unknown) =>
  String(v ?? '')
    .split(/[^0-9]+/)
    .map(Number)
    .filter((n) => n > 0);

export const marketingActions = {
  savePromotion: defineAction({
    accept: 'form',
    input: z.object({ promotionId: z.number().int().nonnegative().default(0) }).catchall(z.any()),
    handler: async (input, ctx) => {
      const admin = requireArea(ctx, 'Promotions', 1);
      const f = input as Record<string, unknown>;
      const s = (k: string) => (f[k] === null || f[k] === undefined ? null : String(f[k]));
      const tiers = [1, 2, 3, 4].map((i) => ({ thresholdCents: dollarsToCents(s(`tierThreshold${i}`)) ?? 0, amountCents: dollarsToCents(s(`tierAmount${i}`)) ?? 0 })).filter((t) => t.thresholdCents > 0 || t.amountCents > 0);
      const data: PromotionInput = {
        code: s('code'),
        title: s('title'),
        status: s('status') === 'active' ? 'active' : 'inactive',
        discountType: (['percent', 'amount', 'none'].includes(s('discountType') ?? '') ? s('discountType') : 'none') as PromotionInput['discountType'],
        percentOff: toNum(s('percentOff')),
        amountOffCents: dollarsToCents(s('amountOff')),
        minSubtotalCents: dollarsToCents(s('minSubtotal')),
        maxSubtotalCents: dollarsToCents(s('maxSubtotal')),
        validFrom: s('validFrom'),
        validTo: s('validTo'),
        onceOnly: toBool(f.onceOnly),
        singleUse: toBool(f.singleUse),
        usableEveryDays: toInt(s('usableEveryDays')),
        freeShipping: toBool(f.freeShipping),
        exclusive: toBool(f.exclusive),
        compoundable: toBool(f.compoundable),
        allowOnForms: toBool(f.allowOnForms),
        multiplyByQty: toBool(f.multiplyByQty),
        scopeKind: toInt(s('scopeKind'), 0) ?? 0,
        scopeRef: toInt(s('scopeRef')),
        matchValue: s('matchValue'),
        giftWithPurchase: toBool(f.giftWithPurchase),
        bogo: toBool(f.bogo),
        tiered: toBool(f.tiered),
        tiers,
        landingKind: toInt(s('landingKind'), 0) ?? 0,
        contentHtml: s('contentHtml'),
        imageUrl: s('imageUrl'),
        productText: s('productText'),
        notes: s('notes'),
        locked: toBool(f.locked),
        legacyExtra: { giftWithPurchaseGroupIds: s('giftIds') ?? '', requirePresenceType: s('presenceType') ?? '', requirePresenceID: toInt(s('presenceId')) ?? 0, hideFreeShipBanner: toBool(f.hideFreeShipBanner) ? 1 : 0, redirectPagename: s('redirectPath') ?? '' },
      };
      // class scopes are stored as negative scopeRef with scopeKind 0
      const cls = toInt(s('scopeClass'));
      if (data.scopeKind === 3 && cls) {
        data.scopeKind = 0;
        data.scopeRef = cls;
      }
      try {
        return { ok: true, id: await savePromotion(input.promotionId || null, data, admin.email, Boolean(admin.siteAdmin)) };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  setPromotionStatus: defineAction({
    accept: 'form',
    input: z.object({ promotionId: z.number().int().positive(), status: z.enum(['active', 'inactive']) }),
    handler: async ({ promotionId, status }, ctx) => {
      const admin = requireArea(ctx, 'Promotions', 1);
      try {
        await setPromotionStatus(promotionId, status, Boolean(admin.siteAdmin));
      } catch (e) {
        return fail(e);
      }
      return { ok: true };
    },
  }),
  duplicatePromotion: defineAction({
    accept: 'form',
    input: z.object({ promotionId: z.number().int().positive() }),
    handler: async ({ promotionId }, ctx) => {
      const admin = requireArea(ctx, 'Promotions', 1);
      try {
        return { ok: true, id: await duplicatePromotion(promotionId, admin.email) };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  deletePromotion: defineAction({
    accept: 'form',
    input: z.object({ promotionId: z.number().int().positive() }),
    handler: async ({ promotionId }, ctx) => {
      const admin = requireArea(ctx, 'Promotions', 1);
      try {
        await deletePromotion(promotionId, Boolean(admin.siteAdmin));
      } catch (e) {
        return fail(e);
      }
      return { ok: true };
    },
  }),

  saveNewsletter: defineAction({
    accept: 'form',
    input: z.object({ newsletterId: z.number().int().nonnegative().default(0), subject: z.string().max(255), bodyHtml: z.string().max(200000), segment: z.enum(['all', 'optin', 'optout']).default('optin'), paidOnly: z.boolean().default(false) }),
    handler: async (input, ctx) => {
      const admin = requireArea(ctx, 'Newsletter', 1);
      try {
        return { ok: true, id: await saveNewsletter(input.newsletterId || null, input, admin.email) };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  sendNewsletterBatch: defineAction({
    accept: 'form',
    input: z.object({ newsletterId: z.number().int().positive(), batchSize: z.number().int().min(1).max(200).default(20) }),
    handler: async ({ newsletterId, batchSize }, ctx) => {
      requireArea(ctx, 'Newsletter', 1);
      try {
        return { ok: true, ...(await sendNewsletterBatch(newsletterId, batchSize)) };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  sendNewsletterPreview: defineAction({
    accept: 'form',
    input: z.object({ newsletterId: z.number().int().positive(), to: z.string().email() }),
    handler: async ({ newsletterId, to }, ctx) => {
      requireArea(ctx, 'Newsletter', 1);
      try {
        return { ok: await sendNewsletterPreview(newsletterId, to) };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  deleteNewsletter: defineAction({
    accept: 'form',
    input: z.object({ newsletterId: z.number().int().positive() }),
    handler: async ({ newsletterId }, ctx) => {
      requireArea(ctx, 'Newsletter', 1);
      await deleteNewsletter(newsletterId);
      return { ok: true };
    },
  }),

  saveAffiliate: defineAction({
    accept: 'form',
    input: z.object({ affiliateId: z.number().int().nonnegative().default(0), name: z.string().max(200), slug: z.string().max(120).nullish(), contentHtml: z.string().max(100000).nullish(), imageUrl: z.string().max(500).nullish(), discountPercent: z.string().max(10).nullish(), active: z.boolean().default(true), productIds: z.string().max(5000).nullish(), categoryIds: z.string().max(5000).nullish() }),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Affiliates', 1);
      try {
        return { ok: true, id: await saveAffiliate(input.affiliateId || null, { name: input.name, slug: input.slug ?? null, contentHtml: input.contentHtml ?? null, imageUrl: input.imageUrl ?? null, discountPercent: toNum(input.discountPercent, 0) ?? 0, active: input.active, productIds: ids(input.productIds), categoryIds: ids(input.categoryIds) }) };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  deleteAffiliate: defineAction({
    accept: 'form',
    input: z.object({ affiliateId: z.number().int().positive() }),
    handler: async ({ affiliateId }, ctx) => {
      requireArea(ctx, 'Affiliates', 1);
      await deleteAffiliate(affiliateId);
      return { ok: true };
    },
  }),
};
