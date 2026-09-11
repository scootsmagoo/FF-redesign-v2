import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { requireArea } from '~/lib/manager/permissions';
import { assignArticle, deleteSupportArticle, deleteSupportCategory, reorderArticles, reorderSupportCategories, saveSupportArticle, saveSupportCategory, setArticleFaq, SupportError } from '~/lib/manager/support';
import { toInt } from '~/lib/manager/util';

const fail = (e: unknown): never => {
  throw new ActionError({ code: 'BAD_REQUEST', message: e instanceof SupportError || e instanceof Error ? e.message : 'Something went wrong' });
};
const ids = (v: unknown) =>
  String(v ?? '')
    .split(/[^0-9]+/)
    .map(Number)
    .filter((n) => n > 0);

/** Support center editing (legacy sa_support.asp). Everything needs full control of Support, as the legacy page did. */
export const supportActions = {
  saveSupportCategory: defineAction({
    accept: 'form',
    input: z.object({ categoryId: z.number().int().nonnegative().default(0), name: z.string().max(120), slug: z.string().max(120).nullish(), imageUrl: z.string().max(500).nullish(), state: z.enum(['active', 'inactive', 'hidden']).default('active'), includeInChat: z.boolean().default(true) }),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Support', 1);
      try {
        return { ok: true, id: await saveSupportCategory(input.categoryId || null, { name: input.name, slug: input.slug ?? null, imageUrl: input.imageUrl ?? null, state: input.state, includeInChat: input.includeInChat }) };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  reorderSupportCategories: defineAction({
    accept: 'form',
    input: z.object({ order: z.string().max(5000) }),
    handler: async ({ order }, ctx) => {
      requireArea(ctx, 'Support', 1);
      await reorderSupportCategories(ids(order));
      return { ok: true };
    },
  }),
  deleteSupportCategory: defineAction({
    accept: 'form',
    input: z.object({ categoryId: z.number().int().positive() }),
    handler: async ({ categoryId }, ctx) => {
      requireArea(ctx, 'Support', 1);
      await deleteSupportCategory(categoryId);
      return { ok: true };
    },
  }),
  assignSupportArticle: defineAction({
    accept: 'form',
    input: z.object({ categoryId: z.number().int().positive(), articleId: z.number().int().positive(), assign: z.boolean().default(true) }),
    handler: async ({ categoryId, articleId, assign }, ctx) => {
      requireArea(ctx, 'Support', 1);
      await assignArticle(categoryId, articleId, assign);
      return { ok: true };
    },
  }),
  reorderSupportArticles: defineAction({
    accept: 'form',
    input: z.object({ categoryId: z.number().int().positive(), order: z.string().max(5000) }),
    handler: async ({ categoryId, order }, ctx) => {
      requireArea(ctx, 'Support', 1);
      await reorderArticles(categoryId, ids(order));
      return { ok: true };
    },
  }),
  saveSupportArticle: defineAction({
    accept: 'form',
    input: z.object({ articleId: z.number().int().nonnegative().default(0), title: z.string().max(200), slug: z.string().max(200).nullish(), contentHtml: z.string().max(200000).nullish(), keywords: z.string().max(2000).nullish(), isFaq: z.boolean().default(false), faqOrder: z.string().max(5).nullish(), categoryIds: z.string().max(2000).nullish() }),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Support', 1);
      try {
        return { ok: true, id: await saveSupportArticle(input.articleId || null, { title: input.title, slug: input.slug ?? null, contentHtml: input.contentHtml ?? '', keywords: input.keywords ?? null, isFaq: input.isFaq, faqOrder: toInt(input.faqOrder), categoryIds: ids(input.categoryIds) }) };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  deleteSupportArticle: defineAction({
    accept: 'form',
    input: z.object({ articleId: z.number().int().positive() }),
    handler: async ({ articleId }, ctx) => {
      requireArea(ctx, 'Support', 1);
      await deleteSupportArticle(articleId);
      return { ok: true };
    },
  }),
  setArticleFaq: defineAction({
    accept: 'form',
    input: z.object({ articleId: z.number().int().positive(), isFaq: z.boolean() }),
    handler: async ({ articleId, isFaq }, ctx) => {
      requireArea(ctx, 'Support', 1);
      await setArticleFaq(articleId, isFaq);
      return { ok: true };
    },
  }),
};
