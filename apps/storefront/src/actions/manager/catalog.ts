import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { requireArea } from '~/lib/manager/permissions';
import {
  addCategoryProducts,
  CatalogError,
  deleteCategory,
  deleteFaq,
  deleteModel,
  deleteOption,
  deleteOptionGroup,
  deleteRedirect,
  deleteReviews,
  deleteSearchRedirect,
  fixRelated,
  linkModelProduct,
  removeCategoryProduct,
  reorderCategoryProducts,
  saveCategory,
  saveFaq,
  saveModel,
  saveOption,
  saveOptionGroup,
  saveRedirect,
  saveReview,
  saveSearchRedirect,
  setReviewStatus,
  setSizeChartActive,
} from '~/lib/manager/catalog';
import { dollarsToCents, toBool, toInt, toNum } from '~/lib/manager/util';

const fail = (e: unknown): never => {
  throw new ActionError({ code: 'BAD_REQUEST', message: e instanceof CatalogError || e instanceof Error ? e.message : 'Something went wrong' });
};
const ids = (v: unknown) =>
  String(v ?? '')
    .split(/[,\s|]+/)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

export const catalogActions = {
  // ----- categories -----
  saveCategory: defineAction({
    accept: 'form',
    input: z.object({ categoryId: z.number().int().nonnegative() }).catchall(z.any()),
    handler: async (input, ctx) => {
      requireArea(ctx, 'ProductCategories', 1);
      const f = input as Record<string, unknown>;
      const s = (k: string) => (f[k] === null || f[k] === undefined ? null : String(f[k]));
      try {
        const id = await saveCategory(input.categoryId || null, {
          name: s('name') ?? '',
          h1: s('h1'),
          slug: s('slug'),
          parentId: toInt(s('parentId')) || null,
          categoryType: s('categoryType'),
          kind: toInt(s('kind')),
          featured: toBool(f.featured),
          active: toBool(f.active),
          hideFromListings: toBool(f.hideFromListings),
          compareActive: toBool(f.compareActive),
          sortOrder: toInt(s('sortOrder'), 0) ?? 0,
          metaTitle: s('metaTitle'),
          metaDescription: s('metaDescription'),
          shortHtml: s('shortHtml'),
          descriptionHtml: s('descriptionHtml'),
          contentLocation: toInt(s('contentLocation'), 0) ?? 0,
          imageUrl: s('imageUrl'),
          graphicUrl: s('graphicUrl'),
          logoUrl: s('logoUrl'),
        });
        return { ok: true, id, created: !input.categoryId };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  deleteCategory: defineAction({
    accept: 'form',
    input: z.object({ categoryId: z.number().int().positive(), confirm: z.string().trim() }),
    handler: async ({ categoryId, confirm }, ctx) => {
      requireArea(ctx, 'ProductCategories', 1);
      if (confirm !== String(categoryId)) throw new ActionError({ code: 'BAD_REQUEST', message: 'Type the category id to confirm.' });
      await deleteCategory(categoryId);
      return { ok: true };
    },
  }),
  addCategoryProducts: defineAction({
    accept: 'form',
    input: z.object({ categoryId: z.number().int().positive(), lines: z.string().max(50000) }),
    handler: async ({ categoryId, lines }, ctx) => {
      requireArea(ctx, 'ProductCategories', 1);
      return { ok: true, ...(await addCategoryProducts(categoryId, lines.split(/\r?\n/))) };
    },
  }),
  removeCategoryProduct: defineAction({
    accept: 'form',
    input: z.object({ categoryId: z.number().int().positive(), productId: z.number().int().positive() }),
    handler: async ({ categoryId, productId }, ctx) => {
      requireArea(ctx, 'ProductCategories', 1);
      await removeCategoryProduct(categoryId, productId);
      return { ok: true };
    },
  }),
  reorderCategoryProducts: defineAction({
    accept: 'form',
    input: z.object({ categoryId: z.number().int().positive(), order: z.string().max(20000) }),
    handler: async ({ categoryId, order }, ctx) => {
      requireArea(ctx, 'ProductCategories', 1);
      await reorderCategoryProducts(categoryId, ids(order));
      return { ok: true };
    },
  }),

  // ----- FAQs -----
  saveFaq: defineAction({
    accept: 'form',
    input: z.object({ faqId: z.number().int().nonnegative().default(0), scope: z.enum(['site', 'product', 'category']), scopeId: z.number().int().nullish(), question: z.string().max(250), answerHtml: z.string().max(20000).nullish(), sortOrder: z.number().int().default(999), active: z.boolean().default(false) }),
    handler: async (input, ctx) => {
      requireArea(ctx, input.scope === 'category' ? 'ProductCategories' : 'Products', 1);
      try {
        return { ok: true, id: await saveFaq({ id: input.faqId || null, scope: input.scope, scopeId: input.scopeId ?? null, question: input.question, answerHtml: input.answerHtml ?? '', sortOrder: input.sortOrder, active: input.active }) };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  deleteFaq: defineAction({
    accept: 'form',
    input: z.object({ faqId: z.number().int().positive(), scope: z.enum(['site', 'product', 'category']).default('product') }),
    handler: async ({ faqId, scope }, ctx) => {
      requireArea(ctx, scope === 'category' ? 'ProductCategories' : 'Products', 1);
      await deleteFaq(faqId);
      return { ok: true };
    },
  }),

  // ----- options -----
  saveOptionGroup: defineAction({
    accept: 'form',
    input: z.object({ groupId: z.number().int().nonnegative().default(0), name: z.string().max(80), displayType: z.string().max(10), required: z.boolean().default(false), sizingLink: z.string().max(300).nullish() }),
    handler: async (input, ctx) => {
      requireArea(ctx, 'ProductOptions', 1);
      try {
        return { ok: true, id: await saveOptionGroup(input.groupId || null, input) };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  deleteOptionGroup: defineAction({
    accept: 'form',
    input: z.object({ groupId: z.number().int().positive() }),
    handler: async ({ groupId }, ctx) => {
      requireArea(ctx, 'ProductOptions', 1);
      try {
        await deleteOptionGroup(groupId);
      } catch (e) {
        return fail(e);
      }
      return { ok: true };
    },
  }),
  saveOption: defineAction({
    accept: 'form',
    input: z.object({ optionId: z.number().int().nonnegative().default(0), groupId: z.number().int().positive(), label: z.string().max(100), priceAdd: z.string().max(12).nullish(), percentAdd: z.string().max(12).nullish(), sortOrder: z.number().int().default(0) }),
    handler: async (input, ctx) => {
      requireArea(ctx, 'ProductOptions', 1);
      try {
        return { ok: true, id: await saveOption(input.optionId || null, { groupId: input.groupId, label: input.label, priceAddCents: dollarsToCents(input.priceAdd) ?? 0, percentAdd: toNum(input.percentAdd, 0) ?? 0, sortOrder: input.sortOrder }) };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  deleteOption: defineAction({
    accept: 'form',
    input: z.object({ optionId: z.number().int().positive() }),
    handler: async ({ optionId }, ctx) => {
      requireArea(ctx, 'ProductOptions', 1);
      await deleteOption(optionId);
      return { ok: true };
    },
  }),

  // ----- redirects -----
  saveRedirect: defineAction({
    accept: 'form',
    input: z.object({ redirectId: z.number().int().nonnegative().default(0), fromPath: z.string().max(500), toPath: z.string().max(500), status: z.number().int().default(301), kind: z.string().max(20).default('manual') }),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Redirects', 1);
      try {
        return { ok: true, id: await saveRedirect({ id: input.redirectId || null, ...input }) };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  deleteRedirect: defineAction({
    accept: 'form',
    input: z.object({ redirectId: z.number().int().positive() }),
    handler: async ({ redirectId }, ctx) => {
      requireArea(ctx, 'Redirects', 1);
      await deleteRedirect(redirectId);
      return { ok: true };
    },
  }),
  saveSearchRedirect: defineAction({
    accept: 'form',
    input: z.object({ redirectId: z.number().int().nonnegative().default(0), keyword: z.string().max(120), productId: z.number().int().nullish(), toPath: z.string().max(500).nullish() }),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Redirects', 1);
      try {
        return { ok: true, id: await saveSearchRedirect({ id: input.redirectId || null, keyword: input.keyword, productId: input.productId ?? null, toPath: input.toPath ?? null }) };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  deleteSearchRedirect: defineAction({
    accept: 'form',
    input: z.object({ redirectId: z.number().int().positive() }),
    handler: async ({ redirectId }, ctx) => {
      requireArea(ctx, 'Redirects', 1);
      await deleteSearchRedirect(redirectId);
      return { ok: true };
    },
  }),

  // ----- reviews -----
  saveReview: defineAction({
    accept: 'form',
    input: z.object({ reviewId: z.number().int().positive(), rating: z.number().int(), status: z.string().max(10), authorName: z.string().max(250), authorLocation: z.string().max(250).nullish(), authorEmail: z.string().max(120).nullish(), title: z.string().max(200).nullish(), body: z.string().max(10000) }),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Reviews', 1);
      try {
        await saveReview(input.reviewId, { rating: input.rating, status: input.status, authorName: input.authorName, authorLocation: input.authorLocation ?? null, authorEmail: input.authorEmail ?? null, title: input.title ?? '', body: input.body });
      } catch (e) {
        return fail(e);
      }
      return { ok: true };
    },
  }),
  bulkReviews: defineAction({
    accept: 'form',
    input: z.object({ ids: z.string().max(5000), op: z.enum(['active', 'pending', 'rejected', 'delete']) }),
    handler: async ({ ids: list, op }, ctx) => {
      requireArea(ctx, 'Reviews', 1);
      const n = ids(list);
      if (op === 'delete') await deleteReviews(n);
      else await setReviewStatus(n, op);
      return { ok: true, count: n.length };
    },
  }),

  // ----- size chart -----
  toggleSizeRow: defineAction({
    accept: 'form',
    input: z.object({ id: z.number().int().positive(), active: z.boolean() }),
    handler: async ({ id, active }, ctx) => {
      requireArea(ctx, 'Products', 1);
      await setSizeChartActive(id, active);
      return { ok: true };
    },
  }),

  // ----- related products audit -----
  fixRelated: defineAction({
    accept: 'form',
    input: z.object({ action: z.enum(['remove', 'replace', 'bulk-remove', 'bulk-replace']), productId: z.number().int().nullish(), relatedId: z.number().int().positive(), newId: z.number().int().nullish() }),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Products', 1);
      try {
        return { ok: true, count: await fixRelated(input) };
      } catch (e) {
        return fail(e);
      }
    },
  }),

  // ----- appliance models -----
  saveModel: defineAction({
    accept: 'form',
    input: z.object({ modelId: z.number().int().positive(), modelNumber: z.string().max(80), brandName: z.string().max(80).nullish(), applianceType: z.string().max(80).nullish(), noindex: z.boolean().default(false) }),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Products', 1);
      try {
        await saveModel(input.modelId, { modelNumber: input.modelNumber, brandName: input.brandName ?? null, applianceType: input.applianceType ?? null, noindex: input.noindex });
      } catch (e) {
        return fail(e);
      }
      return { ok: true };
    },
  }),
  linkModelProduct: defineAction({
    accept: 'form',
    input: z.object({ modelId: z.number().int().positive(), productId: z.number().int().positive(), relation: z.string().max(20).default('compatible'), link: z.boolean().default(true) }),
    handler: async ({ modelId, productId, relation, link }, ctx) => {
      requireArea(ctx, 'Products', 1);
      try {
        await linkModelProduct(modelId, productId, relation, link);
      } catch (e) {
        return fail(e);
      }
      return { ok: true };
    },
  }),
  deleteModel: defineAction({
    accept: 'form',
    input: z.object({ modelId: z.number().int().positive() }),
    handler: async ({ modelId }, ctx) => {
      requireArea(ctx, 'Products', 1);
      await deleteModel(modelId);
      return { ok: true };
    },
  }),
};
