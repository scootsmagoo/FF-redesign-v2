import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm';
import { supportArticles, supportCategories, supportCategoryArticles } from '@ff/db';
import { slugify } from '@ff/domain/urls';
import { getDb } from '../db';

/** Support center editing (legacy sa_support.asp): categories, articles, assignments, FAQ flag. */

export class SupportError extends Error {}

export async function listSupportCategoriesAdmin() {
  return getDb()
    .select({ id: supportCategories.id, name: supportCategories.name, slug: supportCategories.slug, imageUrl: supportCategories.imageUrl, sortOrder: supportCategories.sortOrder, active: supportCategories.active, visible: supportCategories.visible, includeInChat: supportCategories.includeInChat, articleCount: sql<number>`(select count(*) from support_category_articles x where x.category_id = ${supportCategories.id})` })
    .from(supportCategories)
    .orderBy(desc(supportCategories.active), asc(supportCategories.sortOrder), asc(supportCategories.name));
}

export async function getSupportCategoryAdmin(id: number) {
  const db = getDb();
  const category = await db.query.supportCategories.findFirst({ where: eq(supportCategories.id, id) });
  if (!category) return null;
  const [assigned, unassigned] = await Promise.all([
    db.select({ id: supportArticles.id, title: supportArticles.title, slug: supportArticles.slug, sortOrder: supportCategoryArticles.sortOrder }).from(supportCategoryArticles).innerJoin(supportArticles, eq(supportArticles.id, supportCategoryArticles.articleId)).where(eq(supportCategoryArticles.categoryId, id)).orderBy(asc(supportCategoryArticles.sortOrder), asc(supportArticles.title)),
    db.select({ id: supportArticles.id, title: supportArticles.title }).from(supportArticles).where(sql`not exists (select 1 from support_category_articles x where x.article_id = ${supportArticles.id} and x.category_id = ${id})`).orderBy(asc(supportArticles.title)).limit(500),
  ]);
  return { category, assigned, unassigned };
}

export async function saveSupportCategory(id: number | null, input: { name: string; slug: string | null; imageUrl: string | null; state: 'active' | 'inactive' | 'hidden'; includeInChat: boolean }): Promise<number> {
  const db = getDb();
  const name = input.name.trim();
  if (!name) throw new SupportError('Title is required.');
  const existing = id ? await db.query.supportCategories.findFirst({ where: eq(supportCategories.id, id) }) : null;
  const slug = existing ? (input.slug?.trim() ? slugify(input.slug) : existing.slug) : slugify(input.slug?.trim() || name);
  const dup = await db.select({ id: supportCategories.id }).from(supportCategories).where(eq(supportCategories.slug, slug)).limit(1);
  if (dup[0] && dup[0].id !== id) throw new SupportError(`/support/${slug} already exists.`);
  const row = { name, slug, imageUrl: input.imageUrl?.trim() || null, active: input.state !== 'inactive', visible: input.state === 'active', includeInChat: input.includeInChat };
  if (id) {
    await db.update(supportCategories).set(row).where(eq(supportCategories.id, id));
    return id;
  }
  const [max] = await db.select({ m: sql<number>`coalesce(max(id), 0)`, s: sql<number>`coalesce(max(sort_order), 0)` }).from(supportCategories);
  const newId = (max?.m ?? 0) + 1;
  await db.insert(supportCategories).values({ ...row, id: newId, sortOrder: (max?.s ?? 0) + 1 });
  return newId;
}

export async function reorderSupportCategories(ids: number[]): Promise<void> {
  const db = getDb();
  for (let i = 0; i < ids.length; i++) await db.update(supportCategories).set({ sortOrder: i }).where(eq(supportCategories.id, ids[i]!));
}

/** Removes the category and its assignments; articles stay (reachable under /support/articles/…). */
export async function deleteSupportCategory(id: number): Promise<void> {
  await getDb().delete(supportCategories).where(eq(supportCategories.id, id));
}

export async function assignArticle(categoryId: number, articleId: number, assign: boolean): Promise<void> {
  const db = getDb();
  if (!assign) {
    await db.delete(supportCategoryArticles).where(and(eq(supportCategoryArticles.categoryId, categoryId), eq(supportCategoryArticles.articleId, articleId)));
    return;
  }
  const exists = await db.select({ a: supportCategoryArticles.articleId }).from(supportCategoryArticles).where(and(eq(supportCategoryArticles.categoryId, categoryId), eq(supportCategoryArticles.articleId, articleId))).limit(1);
  if (exists[0]) return;
  const [max] = await db.select({ s: sql<number>`coalesce(max(sort_order), 0)` }).from(supportCategoryArticles).where(eq(supportCategoryArticles.categoryId, categoryId));
  await db.insert(supportCategoryArticles).values({ categoryId, articleId, sortOrder: (max?.s ?? 0) + 1 });
}

export async function reorderArticles(categoryId: number, ids: number[]): Promise<void> {
  const db = getDb();
  for (let i = 0; i < ids.length; i++) await db.update(supportCategoryArticles).set({ sortOrder: i }).where(and(eq(supportCategoryArticles.categoryId, categoryId), eq(supportCategoryArticles.articleId, ids[i]!)));
}

export async function listSupportArticlesAdmin(q = '') {
  const db = getDb();
  const t = q.trim();
  return db
    .select({ id: supportArticles.id, title: supportArticles.title, slug: supportArticles.slug, isFaq: supportArticles.isFaq, faqOrder: supportArticles.faqOrder, categoryName: sql<string | null>`(select c.name from support_category_articles x join support_categories c on c.id = x.category_id where x.article_id = ${supportArticles.id} order by x.sort_order limit 1)`, categorySlug: sql<string | null>`(select c.slug from support_category_articles x join support_categories c on c.id = x.category_id where x.article_id = ${supportArticles.id} order by x.sort_order limit 1)` })
    .from(supportArticles)
    .where(t ? or(like(supportArticles.title, `%${t}%`), like(supportArticles.keywords, `%${t}%`), like(supportArticles.contentHtml, `%${t}%`)) : undefined)
    .orderBy(asc(supportArticles.title))
    .limit(1000);
}

export async function getSupportArticleAdmin(id: number) {
  const db = getDb();
  const article = await db.query.supportArticles.findFirst({ where: eq(supportArticles.id, id) });
  if (!article) return null;
  const cats = await db.select({ id: supportCategories.id, name: supportCategories.name }).from(supportCategoryArticles).innerJoin(supportCategories, eq(supportCategories.id, supportCategoryArticles.categoryId)).where(eq(supportCategoryArticles.articleId, id));
  return { article, categoryIds: cats.map((c) => c.id) };
}

export async function saveSupportArticle(id: number | null, input: { title: string; slug: string | null; contentHtml: string; keywords: string | null; isFaq: boolean; faqOrder: number | null; categoryIds: number[] }): Promise<number> {
  const db = getDb();
  const title = input.title.trim();
  if (!title) throw new SupportError('Title is required.');
  const existing = id ? await db.query.supportArticles.findFirst({ where: eq(supportArticles.id, id) }) : null;
  // Unlike the legacy editor, the URL is kept on edit unless changed on purpose (it regenerated it on every save and broke links).
  const slug = existing ? (input.slug?.trim() ? slugify(input.slug) : existing.slug) : slugify(input.slug?.trim() || title.replace(/filtersfast\.com/gi, 'filtersfast-com'));
  const dup = await db.select({ id: supportArticles.id }).from(supportArticles).where(eq(supportArticles.slug, slug)).limit(1);
  if (dup[0] && dup[0].id !== id) throw new SupportError(`An article with URL "${slug}" already exists.`);
  const row = { title, slug, contentHtml: input.contentHtml, keywords: input.keywords?.toLowerCase().replace(/\s+/g, ' ').trim() || null, isFaq: input.isFaq, faqOrder: input.isFaq ? input.faqOrder : null };
  let artId = id;
  if (artId) await db.update(supportArticles).set(row).where(eq(supportArticles.id, artId));
  else {
    const [max] = await db.select({ m: sql<number>`coalesce(max(id), 0)` }).from(supportArticles);
    artId = (max?.m ?? 0) + 1;
    await db.insert(supportArticles).values({ ...row, id: artId });
  }
  const current = await db.select({ categoryId: supportCategoryArticles.categoryId }).from(supportCategoryArticles).where(eq(supportCategoryArticles.articleId, artId));
  const want = new Set(input.categoryIds);
  for (const c of current) if (!want.has(c.categoryId)) await assignArticle(c.categoryId, artId, false);
  for (const cid of want) if (!current.some((c) => c.categoryId === cid)) await assignArticle(cid, artId, true);
  return artId;
}

export async function deleteSupportArticle(id: number): Promise<void> {
  await getDb().delete(supportArticles).where(eq(supportArticles.id, id));
}

export async function setArticleFaq(id: number, isFaq: boolean): Promise<void> {
  const db = getDb();
  const [max] = await db.select({ m: sql<number>`coalesce(max(faq_order), 0)` }).from(supportArticles).where(eq(supportArticles.isFaq, true));
  await db.update(supportArticles).set({ isFaq, faqOrder: isFaq ? (max?.m ?? 0) + 1 : null }).where(eq(supportArticles.id, id));
}
