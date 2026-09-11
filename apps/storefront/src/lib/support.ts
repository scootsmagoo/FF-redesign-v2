import { and, asc, eq, or, sql } from 'drizzle-orm';
import { faqs, supportArticles, supportCategories, supportCategoryArticles } from '@ff/db';
import { getDb } from './db';

/** Support center (legacy /support/ portal) and product/category FAQs. */

const articleCols = {
  id: supportArticles.id,
  slug: supportArticles.slug,
  title: supportArticles.title,
  keywords: supportArticles.keywords,
  /** first category the article belongs to, for its URL */
  categorySlug: sql<string | null>`(select c.slug from support_category_articles x join support_categories c on c.id = x.category_id where x.article_id = ${supportArticles.id} and c.active = 1 order by x.sort_order limit 1)`,
};

export const articlePath = (a: { slug: string; categorySlug: string | null }) => `/support/${a.categorySlug ?? 'articles'}/${a.slug}`;

export async function listSupportCategories() {
  return getDb()
    .select({
      id: supportCategories.id,
      name: supportCategories.name,
      slug: supportCategories.slug,
      imageUrl: supportCategories.imageUrl,
      articleCount: sql<number>`(select count(*) from support_category_articles x where x.category_id = ${supportCategories.id})`,
    })
    .from(supportCategories)
    .where(and(eq(supportCategories.active, true), eq(supportCategories.visible, true)))
    .orderBy(asc(supportCategories.sortOrder), asc(supportCategories.name));
}

export async function getSupportCategory(slug: string) {
  return getDb().query.supportCategories.findFirst({ where: and(eq(supportCategories.slug, slug), eq(supportCategories.active, true)) });
}

export async function listCategoryArticles(categoryId: number) {
  return getDb()
    .select(articleCols)
    .from(supportCategoryArticles)
    .innerJoin(supportArticles, eq(supportArticles.id, supportCategoryArticles.articleId))
    .where(eq(supportCategoryArticles.categoryId, categoryId))
    .orderBy(asc(supportCategoryArticles.sortOrder), asc(supportArticles.title));
}

export async function getSupportArticle(slug: string) {
  const db = getDb();
  const article = await db.query.supportArticles.findFirst({ where: eq(supportArticles.slug, slug) });
  if (!article) return null;
  const categories = await db
    .select({ id: supportCategories.id, name: supportCategories.name, slug: supportCategories.slug })
    .from(supportCategoryArticles)
    .innerJoin(supportCategories, eq(supportCategories.id, supportCategoryArticles.categoryId))
    .where(and(eq(supportCategoryArticles.articleId, article.id), eq(supportCategories.active, true)))
    .orderBy(asc(supportCategoryArticles.sortOrder));
  return { article, categories };
}

/** Articles promoted as FAQs on the support home page. */
export async function listFaqArticles() {
  return getDb().select(articleCols).from(supportArticles).where(eq(supportArticles.isFaq, true)).orderBy(asc(supportArticles.faqOrder), asc(supportArticles.id));
}

export async function searchSupport(qIn: string, limit = 20) {
  const q = qIn.trim();
  if (q.length < 2) return [];
  const pattern = `%${q}%`;
  return getDb()
    .select(articleCols)
    .from(supportArticles)
    .where(or(sql`lower(${supportArticles.title}) like lower(${pattern})`, sql`lower(coalesce(${supportArticles.keywords}, '')) like lower(${pattern})`, sql`lower(${supportArticles.contentHtml}) like lower(${pattern})`))
    .orderBy(sql`case when lower(${supportArticles.title}) like lower(${pattern}) then 0 else 1 end`, asc(supportArticles.title))
    .limit(limit);
}

/** Product or category FAQs (legacy faq table), for PDP and category pages. */
export async function listFaqs(scope: 'product' | 'category' | 'site', scopeId: number | null = null) {
  return getDb()
    .select({ id: faqs.id, question: faqs.question, answerHtml: faqs.answerHtml })
    .from(faqs)
    .where(and(eq(faqs.scope, scope), eq(faqs.active, true), scopeId === null ? sql`${faqs.scopeId} is null` : eq(faqs.scopeId, scopeId)))
    .orderBy(asc(faqs.sortOrder), asc(faqs.id));
}
