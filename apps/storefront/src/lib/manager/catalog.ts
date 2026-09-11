import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { airFilterSizeProducts, applianceModels, categories, categoryProducts, faqs, modelProducts, optionGroups, options, productOptionGroups, productOptions, products, redirects, relatedProducts, reviews, searchLog, searchRedirects } from '@ff/db';
import { normalizeModelNumber } from '@ff/domain/models';
import { legacyPathToCanonical, slugify } from '@ff/domain/urls';
import { getDb } from '../db';
import { offsetFor, PAGE_SIZE } from './util';

/**
 * Catalog side of the manager: categories, options, FAQs, redirects, reviews, search log,
 * size chart, related-product audit, appliance models (legacy SA_cat*, SA_opt*, SA_optGrp*,
 * SA_*FAQManager, SA_redirects, SA_rev*, SA_searchlog, sa_listbysize, SA_related_products).
 */

export class CatalogError extends Error {}

// ---------- categories ----------

export async function listCategoryTree() {
  const db = getDb();
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      parentId: categories.parentId,
      slug: categories.slug,
      categoryType: categories.categoryType,
      sortOrder: categories.sortOrder,
      featured: categories.featured,
      active: categories.active,
      hideFromListings: categories.hideFromListings,
      productCount: sql<number>`(select count(*) from category_products cp where cp.category_id = ${categories.id})`,
    })
    .from(categories)
    .orderBy(asc(categories.categoryType), asc(categories.name));
  const byParent = new Map<number | null, typeof rows>();
  for (const r of rows) {
    const k = r.parentId && rows.some((x) => x.id === r.parentId) ? r.parentId : null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(r);
  }
  const roots = (byParent.get(null) ?? []).sort((a, b) => a.name.localeCompare(b.name));
  return { roots, childrenOf: (id: number) => byParent.get(id) ?? [], all: rows };
}

export async function getCategoryAdmin(id: number) {
  const db = getDb();
  const category = await db.query.categories.findFirst({ where: eq(categories.id, id) });
  if (!category) return null;
  const [parent, prods, faqRows, kids] = await Promise.all([
    category.parentId ? db.query.categories.findFirst({ columns: { id: true, name: true }, where: eq(categories.id, category.parentId) }) : Promise.resolve(null),
    db
      .select({ id: products.id, sku: products.sku, name: products.name, active: products.active, sortOrder: categoryProducts.sortOrder })
      .from(categoryProducts)
      .innerJoin(products, eq(products.id, categoryProducts.productId))
      .where(eq(categoryProducts.categoryId, id))
      .orderBy(asc(categoryProducts.sortOrder), asc(products.name))
      .limit(2000),
    db.select().from(faqs).where(and(eq(faqs.scope, 'category'), eq(faqs.scopeId, id))).orderBy(asc(faqs.sortOrder), asc(faqs.id)),
    db.select({ id: categories.id, name: categories.name, active: categories.active }).from(categories).where(eq(categories.parentId, id)).orderBy(asc(categories.name)),
  ]);
  return { category, parent: parent ?? null, products: prods, faqs: faqRows, children: kids };
}

export const CATEGORY_TYPES = ['', 'Brands', 'Size', 'Type', 'Filtration Level', 'Deal', 'MarketingPromos'];

export interface CategoryInput {
  name: string;
  h1?: string | null;
  slug?: string | null;
  parentId: number | null;
  categoryType?: string | null;
  kind?: number | null;
  featured: boolean;
  active: boolean;
  hideFromListings: boolean;
  compareActive: boolean;
  sortOrder: number;
  metaTitle?: string | null;
  metaDescription?: string | null;
  shortHtml?: string | null;
  descriptionHtml?: string | null;
  contentLocation: number;
  imageUrl?: string | null;
  graphicUrl?: string | null;
  logoUrl?: string | null;
}

async function isDescendant(candidateParent: number, ofId: number): Promise<boolean> {
  const db = getDb();
  let cur: number | null = candidateParent;
  for (let i = 0; i < 20 && cur; i++) {
    if (cur === ofId) return true;
    const row: { parentId: number | null } | undefined = await db.query.categories.findFirst({ columns: { parentId: true }, where: eq(categories.id, cur) });
    cur = row?.parentId ?? null;
  }
  return false;
}

export async function saveCategory(id: number | null, input: CategoryInput): Promise<number> {
  const db = getDb();
  const name = input.name.trim();
  if (!name) throw new CatalogError('Category name is required.');
  if (id && input.parentId === id) throw new CatalogError('A category cannot be its own parent.');
  if (id && input.parentId && (await isDescendant(input.parentId, id))) throw new CatalogError('A category cannot be moved under one of its own sub-categories.');
  if (input.parentId) {
    const parent = await db.query.categories.findFirst({ columns: { id: true }, where: eq(categories.id, input.parentId) });
    if (!parent) throw new CatalogError('Parent category not found.');
  }
  let slug = slugify((input.slug ?? '').trim() || name);
  if (!slug) throw new CatalogError('URL slug is required.');
  const dup = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1);
  if (dup[0] && dup[0].id !== id) throw new CatalogError(`A category with URL "/c/${slug}" already exists (#${dup[0].id}).`);
  if ((input.shortHtml ?? '').length > 255) throw new CatalogError('Short HTML must be 255 characters or fewer.');
  const row = {
    name,
    h1: input.h1?.trim() || null,
    slug,
    parentId: input.parentId,
    categoryType: input.categoryType?.trim() || null,
    kind: input.kind ?? null,
    featured: input.featured,
    active: input.active,
    hideFromListings: input.hideFromListings,
    compareActive: input.compareActive,
    sortOrder: input.sortOrder,
    metaTitle: input.metaTitle?.trim() || null,
    metaDescription: input.metaDescription?.trim() || null,
    shortHtml: input.shortHtml?.trim() || null,
    descriptionHtml: input.descriptionHtml || null,
    contentLocation: input.contentLocation === 1 ? 1 : 0,
    imageUrl: input.imageUrl?.trim() || null,
    graphicUrl: input.graphicUrl?.trim() || null,
    logoUrl: input.logoUrl?.trim() || null,
  };
  if (id) {
    await db.update(categories).set(row).where(eq(categories.id, id));
    return id;
  }
  const [max] = await db.select({ m: sql<number>`coalesce(max(id), 0)` }).from(categories);
  const newId = (max?.m ?? 0) + 1;
  await db.insert(categories).values({ ...row, id: newId });
  return newId;
}

/** Removes the category and its product links; sub-categories move to the parent (legacy left them orphaned). */
export async function deleteCategory(id: number): Promise<void> {
  const db = getDb();
  const cat = await db.query.categories.findFirst({ columns: { parentId: true }, where: eq(categories.id, id) });
  if (!cat) return;
  await db.update(categories).set({ parentId: cat.parentId }).where(eq(categories.parentId, id));
  await db.delete(faqs).where(and(eq(faqs.scope, 'category'), eq(faqs.scopeId, id)));
  await db.delete(categories).where(eq(categories.id, id));
}

/** Adds products by SKU or id (one per line). Returns what was added and what was not found. */
export async function addCategoryProducts(categoryId: number, lines: string[]): Promise<{ added: number; missing: string[] }> {
  const db = getDb();
  const tokens = lines.map((l) => l.trim()).filter(Boolean);
  if (!tokens.length) return { added: 0, missing: [] };
  const ids = tokens.filter((t) => /^\d+$/.test(t)).map(Number);
  const skus = tokens.filter((t) => !/^\d+$/.test(t)).map((t) => t.toUpperCase());
  const found = await db
    .select({ id: products.id, sku: products.sku })
    .from(products)
    .where(or(ids.length ? inArray(products.id, ids) : undefined, skus.length ? inArray(sql`upper(${products.sku})`, skus) : undefined));
  const foundIds = new Set(found.map((f) => f.id));
  const foundSkus = new Set(found.map((f) => f.sku.toUpperCase()));
  const missing = tokens.filter((t) => (/^\d+$/.test(t) ? !foundIds.has(Number(t)) : !foundSkus.has(t.toUpperCase())));
  const existing = await db.select({ productId: categoryProducts.productId }).from(categoryProducts).where(eq(categoryProducts.categoryId, categoryId));
  const have = new Set(existing.map((e) => e.productId));
  const fresh = [...foundIds].filter((i) => !have.has(i));
  if (fresh.length) await db.insert(categoryProducts).values(fresh.map((productId) => ({ categoryId, productId, sortOrder: 0 })));
  return { added: fresh.length, missing };
}

export async function removeCategoryProduct(categoryId: number, productId: number): Promise<void> {
  await getDb().delete(categoryProducts).where(and(eq(categoryProducts.categoryId, categoryId), eq(categoryProducts.productId, productId)));
}

export async function reorderCategoryProducts(categoryId: number, orderedIds: number[]): Promise<void> {
  const db = getDb();
  for (let i = 0; i < orderedIds.length; i++) await db.update(categoryProducts).set({ sortOrder: i }).where(and(eq(categoryProducts.categoryId, categoryId), eq(categoryProducts.productId, orderedIds[i]!)));
}

// ---------- FAQs (site / product / category) ----------

export type FaqScope = 'site' | 'product' | 'category';

export async function listFaqs(scope: FaqScope, scopeId: number | null) {
  const db = getDb();
  return db
    .select()
    .from(faqs)
    .where(and(eq(faqs.scope, scope), scopeId === null ? sql`${faqs.scopeId} is null` : eq(faqs.scopeId, scopeId)))
    .orderBy(asc(faqs.sortOrder), asc(faqs.id));
}

/** Overview of which products/categories carry FAQs. */
export async function listFaqOwners() {
  const db = getDb();
  // Joined per scope (no inArray: D1 caps bound parameters at 100 and there are thousands of product FAQs).
  const count = sql<number>`count(*)`;
  const active = sql<number>`sum(case when ${faqs.active} then 1 else 0 end)`;
  const [site, prod, cat] = await Promise.all([
    db.select({ count, active }).from(faqs).where(eq(faqs.scope, 'site')),
    db
      .select({ scopeId: faqs.scopeId, count, active, label: sql<string>`coalesce(${products.sku} || ' · ' || ${products.name}, 'product #' || ${faqs.scopeId})` })
      .from(faqs)
      .leftJoin(products, eq(products.id, faqs.scopeId))
      .where(eq(faqs.scope, 'product'))
      .groupBy(faqs.scopeId)
      .orderBy(asc(products.sku))
      .limit(1000),
    db
      .select({ scopeId: faqs.scopeId, count, active, label: sql<string>`coalesce(${categories.name}, 'category #' || ${faqs.scopeId})` })
      .from(faqs)
      .leftJoin(categories, eq(categories.id, faqs.scopeId))
      .where(eq(faqs.scope, 'category'))
      .groupBy(faqs.scopeId)
      .orderBy(asc(categories.name))
      .limit(1000),
  ]);
  const out: { scope: FaqScope; scopeId: number | null; count: number; active: number; label: string }[] = [];
  if ((site[0]?.count ?? 0) > 0) out.push({ scope: 'site', scopeId: null, count: site[0]!.count, active: site[0]!.active, label: 'Site-wide' });
  for (const r of cat) out.push({ scope: 'category', scopeId: r.scopeId, count: r.count, active: r.active, label: r.label });
  for (const r of prod) out.push({ scope: 'product', scopeId: r.scopeId, count: r.count, active: r.active, label: r.label });
  return out;
}

export async function saveFaq(input: { id?: number | null; scope: FaqScope; scopeId: number | null; question: string; answerHtml: string; sortOrder: number; active: boolean }): Promise<number> {
  const db = getDb();
  const question = input.question.trim().slice(0, 250);
  if (!question) throw new CatalogError('Question is required.');
  const row = { scope: input.scope, scopeId: input.scope === 'site' ? null : input.scopeId, question, answerHtml: input.answerHtml, sortOrder: input.sortOrder, active: input.active };
  if (input.id) {
    await db.update(faqs).set(row).where(eq(faqs.id, input.id));
    return input.id;
  }
  const [r] = await db.insert(faqs).values(row).returning({ id: faqs.id });
  return r!.id;
}

export async function deleteFaq(id: number): Promise<void> {
  await getDb().delete(faqs).where(eq(faqs.id, id));
}

// ---------- options and option groups ----------

export async function listOptionGroupsAdmin() {
  return getDb()
    .select({
      id: optionGroups.id,
      name: optionGroups.name,
      displayType: optionGroups.displayType,
      required: optionGroups.required,
      sizingLink: optionGroups.sizingLink,
      optionCount: sql<number>`(select count(*) from options o where o.group_id = ${optionGroups.id})`,
      productCount: sql<number>`(select count(*) from product_option_groups pg where pg.group_id = ${optionGroups.id})`,
    })
    .from(optionGroups)
    .orderBy(asc(optionGroups.name));
}

export async function getOptionGroupAdmin(id: number) {
  const db = getDb();
  const group = await db.query.optionGroups.findFirst({ where: eq(optionGroups.id, id) });
  if (!group) return null;
  const [opts, prods] = await Promise.all([
    db.select({ id: options.id, label: options.label, priceAddCents: options.priceAddCents, percentAdd: options.percentAdd, sortOrder: options.sortOrder, productCount: sql<number>`(select count(*) from product_options po where po.option_id = ${options.id})` }).from(options).where(eq(options.groupId, id)).orderBy(asc(options.sortOrder), asc(options.label)),
    db.select({ id: products.id, sku: products.sku, name: products.name }).from(productOptionGroups).innerJoin(products, eq(products.id, productOptionGroups.productId)).where(eq(productOptionGroups.groupId, id)).orderBy(asc(products.sku)).limit(500),
  ]);
  return { group, options: opts, products: prods };
}

export async function saveOptionGroup(id: number | null, input: { name: string; displayType: string; required: boolean; sizingLink?: string | null }): Promise<number> {
  const db = getDb();
  const name = input.name.trim();
  if (!name) throw new CatalogError('Group name is required.');
  const displayType = input.displayType === 'radio' || input.displayType === 'text' ? input.displayType : 'select';
  if (id && displayType === 'text') {
    const [c] = await db.select({ n: sql<number>`count(*)` }).from(options).where(eq(options.groupId, id));
    if ((c?.n ?? 0) > 1) throw new CatalogError('A text-input group may hold at most one option.');
  }
  const row = { name, displayType, required: input.required, sizingLink: input.sizingLink?.trim() || null };
  if (id) {
    await db.update(optionGroups).set(row).where(eq(optionGroups.id, id));
    return id;
  }
  const [max] = await db.select({ m: sql<number>`coalesce(max(id), 0)` }).from(optionGroups);
  const newId = (max?.m ?? 0) + 1;
  await db.insert(optionGroups).values({ ...row, id: newId });
  return newId;
}

export async function deleteOptionGroup(id: number): Promise<void> {
  const db = getDb();
  const [o] = await db.select({ n: sql<number>`count(*)` }).from(options).where(eq(options.groupId, id));
  if ((o?.n ?? 0) > 0) throw new CatalogError('Delete or move its options first.');
  const [p] = await db.select({ n: sql<number>`count(*)` }).from(productOptionGroups).where(eq(productOptionGroups.groupId, id));
  if ((p?.n ?? 0) > 0) throw new CatalogError('Products still use this group; remove it from them first.');
  await db.delete(optionGroups).where(eq(optionGroups.id, id));
}

export async function getOptionAdmin(id: number) {
  const db = getDb();
  const option = await db.query.options.findFirst({ where: eq(options.id, id) });
  if (!option) return null;
  const [group, excluded] = await Promise.all([
    db.query.optionGroups.findFirst({ where: eq(optionGroups.id, option.groupId) }),
    db.select({ id: products.id, sku: products.sku, name: products.name, excluded: productOptions.excluded, stock: productOptions.stock }).from(productOptions).innerJoin(products, eq(products.id, productOptions.productId)).where(eq(productOptions.optionId, id)).orderBy(asc(products.sku)).limit(500),
  ]);
  return { option, group: group ?? null, products: excluded };
}

export async function saveOption(id: number | null, input: { groupId: number; label: string; priceAddCents: number; percentAdd: number; sortOrder: number }): Promise<number> {
  const db = getDb();
  const label = input.label.trim();
  if (!label) throw new CatalogError('Option label is required.');
  const group = await db.query.optionGroups.findFirst({ where: eq(optionGroups.id, input.groupId) });
  if (!group) throw new CatalogError('Option group not found.');
  if (group.displayType === 'text') {
    const [c] = await db.select({ n: sql<number>`count(*)` }).from(options).where(and(eq(options.groupId, input.groupId), id ? sql`${options.id} <> ${id}` : sql`1 = 1`));
    if ((c?.n ?? 0) >= 1) throw new CatalogError('A text-input group may hold only one option.');
  }
  const row = { groupId: input.groupId, label, priceAddCents: input.priceAddCents, percentAdd: input.percentAdd, sortOrder: input.sortOrder };
  if (id) {
    await db.update(options).set(row).where(eq(options.id, id));
    return id;
  }
  const [max] = await db.select({ m: sql<number>`coalesce(max(id), 0)` }).from(options);
  const newId = (max?.m ?? 0) + 1;
  await db.insert(options).values({ ...row, id: newId });
  return newId;
}

/** Deletes the option and its per-product rows (legacy left prices/images orphaned). */
export async function deleteOption(id: number): Promise<void> {
  await getDb().delete(options).where(eq(options.id, id));
}

// ---------- redirects ----------

export async function listRedirects(opts: { q?: string; kind?: string; page?: number }) {
  const db = getDb();
  const q = (opts.q ?? '').trim();
  const where = and(q ? or(like(redirects.fromPath, `%${q}%`), like(redirects.toPath, `%${q}%`)) : undefined, opts.kind ? eq(redirects.kind, opts.kind) : undefined);
  const page = Math.max(1, opts.page ?? 1);
  const [rows, [count]] = await Promise.all([
    db.select().from(redirects).where(where).orderBy(desc(redirects.id)).limit(PAGE_SIZE).offset(offsetFor(page)),
    db.select({ n: sql<number>`count(*)` }).from(redirects).where(where),
  ]);
  return { rows, total: count?.n ?? 0, page, pageSize: PAGE_SIZE };
}

export async function saveRedirect(input: { id?: number | null; fromPath: string; toPath: string; status: number; kind: string }): Promise<number> {
  const db = getDb();
  const strip = (s: string) => s.trim().replace(/^https?:\/\/(www\.)?(filtersfast\.com|ffastest\.com)/i, '');
  let from = strip(input.fromPath);
  let to = strip(input.toPath);
  if (!from.startsWith('/')) from = '/' + from;
  if (!/^https?:\/\//i.test(to) && !to.startsWith('/')) to = '/' + to;
  if (from === to) throw new CatalogError('The two paths are the same.');
  if (from.length < 2) throw new CatalogError('Enter the old path.');
  // legacy .asp targets are rewritten to the canonical v2 URL when the pattern rules know it
  const canon = legacyPathToCanonical(to);
  if (canon) to = canon;
  const status = input.status === 302 ? 302 : 301;
  const kind = ['product', 'category', 'keyword', 'manual'].includes(input.kind) ? input.kind : 'manual';
  const dup = await db.select({ id: redirects.id }).from(redirects).where(eq(redirects.fromPath, from)).limit(1);
  if (dup[0] && dup[0].id !== input.id) throw new CatalogError(`"${from}" already redirects (#${dup[0].id}).`);
  if (input.id) {
    await db.update(redirects).set({ fromPath: from, toPath: to, status, kind }).where(eq(redirects.id, input.id));
    return input.id;
  }
  const [r] = await db.insert(redirects).values({ fromPath: from, toPath: to, status, kind }).returning({ id: redirects.id });
  return r!.id;
}

export async function deleteRedirect(id: number): Promise<void> {
  await getDb().delete(redirects).where(eq(redirects.id, id));
}

export async function listSearchRedirects(q: string, page = 1) {
  const db = getDb();
  const t = q.trim();
  const where = t ? or(like(searchRedirects.keyword, `%${t}%`), like(searchRedirects.toPath, `%${t}%`)) : undefined;
  const [rows, [count]] = await Promise.all([
    db
      .select({ id: searchRedirects.id, keyword: searchRedirects.keyword, productId: searchRedirects.productId, toPath: searchRedirects.toPath, kind: searchRedirects.kind, sku: products.sku })
      .from(searchRedirects)
      .leftJoin(products, eq(products.id, searchRedirects.productId))
      .where(where)
      .orderBy(asc(searchRedirects.keyword))
      .limit(PAGE_SIZE)
      .offset(offsetFor(page)),
    db.select({ n: sql<number>`count(*)` }).from(searchRedirects).where(where),
  ]);
  return { rows, total: count?.n ?? 0, page, pageSize: PAGE_SIZE };
}

export function normalizeKeyword(k: string): string {
  return k.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function saveSearchRedirect(input: { id?: number | null; keyword: string; productId: number | null; toPath: string | null }): Promise<number> {
  const db = getDb();
  const keyword = input.keyword.trim();
  if (!keyword) throw new CatalogError('Keyword is required.');
  if (!input.productId && !input.toPath?.trim()) throw new CatalogError('Give a product id or a path to send the search to.');
  const row = { keyword, normalized: normalizeKeyword(keyword), productId: input.productId || null, toPath: input.productId ? null : input.toPath!.trim(), kind: input.productId ? 0 : 1 };
  if (input.id) {
    await db.update(searchRedirects).set(row).where(eq(searchRedirects.id, input.id));
    return input.id;
  }
  const [r] = await db.insert(searchRedirects).values(row).returning({ id: searchRedirects.id });
  return r!.id;
}

export async function deleteSearchRedirect(id: number): Promise<void> {
  await getDb().delete(searchRedirects).where(eq(searchRedirects.id, id));
}

// ---------- reviews ----------

export const REVIEW_STATUSES = ['active', 'pending', 'rejected'] as const;

export async function listReviewsAdmin(opts: { status?: string; rating?: number | null; q?: string; productId?: number | null; sort?: string; page?: number }) {
  const db = getDb();
  const q = (opts.q ?? '').trim();
  const where = and(
    opts.status && (REVIEW_STATUSES as readonly string[]).includes(opts.status) ? eq(reviews.status, opts.status) : undefined,
    opts.rating ? eq(reviews.rating, opts.rating) : undefined,
    opts.productId ? eq(reviews.productId, opts.productId) : undefined,
    q ? or(like(reviews.title, `%${q}%`), like(reviews.body, `%${q}%`), like(reviews.authorName, `%${q}%`), like(reviews.authorLocation, `%${q}%`), like(reviews.ipAddress, `%${q}%`)) : undefined,
  );
  const order = opts.sort === 'date-asc' ? [asc(reviews.createdAt)] : opts.sort === 'name' ? [asc(reviews.authorName)] : opts.sort === 'rating' ? [desc(reviews.rating)] : opts.sort === 'status' ? [asc(reviews.status)] : [desc(reviews.createdAt)];
  const page = Math.max(1, opts.page ?? 1);
  const [rows, [count]] = await Promise.all([
    db
      .select({ id: reviews.id, productId: reviews.productId, productName: products.name, sku: products.sku, rating: reviews.rating, title: reviews.title, body: reviews.body, authorName: reviews.authorName, authorLocation: reviews.authorLocation, status: reviews.status, createdAt: reviews.createdAt, ipAddress: reviews.ipAddress, source: reviews.source })
      .from(reviews)
      .leftJoin(products, eq(products.id, reviews.productId))
      .where(where)
      .orderBy(...order)
      .limit(20)
      .offset(offsetFor(page, 20)),
    db.select({ n: sql<number>`count(*)` }).from(reviews).where(where),
  ]);
  return { rows, total: count?.n ?? 0, page, pageSize: 20 };
}

export async function getReviewAdmin(id: number) {
  const db = getDb();
  const r = await db.query.reviews.findFirst({ where: eq(reviews.id, id) });
  if (!r) return null;
  const product = await db.query.products.findFirst({ columns: { id: true, sku: true, name: true, slug: true }, where: eq(products.id, r.productId) });
  return { review: r, product: product ?? null };
}

export async function saveReview(id: number, input: { rating: number; status: string; authorName: string; authorLocation: string | null; authorEmail: string | null; title: string; body: string }): Promise<void> {
  if (!(REVIEW_STATUSES as readonly string[]).includes(input.status)) throw new CatalogError('Unknown status.');
  if (input.rating < 1 || input.rating > 5) throw new CatalogError('Rating must be 1 to 5.');
  if (!input.authorName.trim()) throw new CatalogError('Reviewer name is required.');
  if (!input.body.trim()) throw new CatalogError('Review text is required.');
  await getDb()
    .update(reviews)
    .set({ rating: input.rating, status: input.status, approved: input.status === 'active', authorName: input.authorName.trim(), authorLocation: input.authorLocation?.trim() || null, authorEmail: input.authorEmail?.trim() || null, title: input.title.trim() || null, body: input.body.trim() })
    .where(eq(reviews.id, id));
}

export async function setReviewStatus(ids: number[], status: string): Promise<void> {
  if (!ids.length) return;
  if (!(REVIEW_STATUSES as readonly string[]).includes(status)) throw new CatalogError('Unknown status.');
  await getDb().update(reviews).set({ status, approved: status === 'active' }).where(inArray(reviews.id, ids));
}

export async function deleteReviews(ids: number[]): Promise<void> {
  if (ids.length) await getDb().delete(reviews).where(inArray(reviews.id, ids));
}

export async function productsWithReviews() {
  return getDb()
    .select({ id: products.id, sku: products.sku, name: products.name })
    .from(products)
    .where(sql`exists (select 1 from reviews r where r.product_id = ${products.id})`)
    .orderBy(asc(products.name))
    .limit(1000);
}

// ---------- search log ----------

export async function listSearchLog(opts: { q?: string; outcome?: string; page?: number }) {
  const db = getDb();
  const q = (opts.q ?? '').trim();
  const where = and(q ? like(searchLog.query, `%${q}%`) : undefined, opts.outcome ? eq(searchLog.outcome, opts.outcome) : undefined);
  const page = Math.max(1, opts.page ?? 1);
  const [rows, [count], outcomes] = await Promise.all([
    db.select().from(searchLog).where(where).orderBy(desc(searchLog.id)).limit(100).offset(offsetFor(page, 100)),
    db.select({ n: sql<number>`count(*)` }).from(searchLog).where(where),
    db.select({ outcome: searchLog.outcome, n: sql<number>`count(*)` }).from(searchLog).groupBy(searchLog.outcome),
  ]);
  return { rows, total: count?.n ?? 0, page, pageSize: 100, outcomes };
}

/** Most frequent zero-result queries in the last N days: the list-by-size and redirect candidates. */
export async function topMissedSearches(days = 30, limit = 50) {
  return getDb()
    .select({ query: searchLog.query, n: sql<number>`count(*)` })
    .from(searchLog)
    .where(and(sql`${searchLog.createdAt} >= datetime('now', ${`-${days} days`})`, or(eq(searchLog.resultCount, 0), sql`${searchLog.resultCount} is null and ${searchLog.outcome} = 'search'`)))
    .groupBy(searchLog.query)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

// ---------- size chart ----------

export async function listSizeChart(sizeKey?: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: airFilterSizeProducts.id,
      sizeKey: airFilterSizeProducts.sizeKey,
      merv: airFilterSizeProducts.merv,
      brand: airFilterSizeProducts.brand,
      active: airFilterSizeProducts.active,
      row: airFilterSizeProducts.row,
      col: airFilterSizeProducts.col,
      productId: airFilterSizeProducts.productId,
      optionId: airFilterSizeProducts.optionId,
      sku: products.sku,
      name: products.name,
      priceCents: products.priceCents,
      stock: products.stock,
      ignoreStock: products.ignoreStock,
      productActive: products.active,
      optionLabel: options.label,
      optionStock: productOptions.stock,
      optionExcluded: productOptions.excluded,
    })
    .from(airFilterSizeProducts)
    .innerJoin(products, eq(products.id, airFilterSizeProducts.productId))
    .leftJoin(options, eq(options.id, airFilterSizeProducts.optionId))
    .leftJoin(productOptions, and(eq(productOptions.productId, airFilterSizeProducts.productId), eq(productOptions.optionId, airFilterSizeProducts.optionId)))
    .where(sizeKey ? eq(airFilterSizeProducts.sizeKey, sizeKey) : undefined)
    .orderBy(asc(airFilterSizeProducts.sizeKey), asc(airFilterSizeProducts.row), asc(airFilterSizeProducts.col))
    .limit(2000);
  return rows;
}

export async function setSizeChartActive(id: number, active: boolean): Promise<void> {
  await getDb().update(airFilterSizeProducts).set({ active }).where(eq(airFilterSizeProducts.id, id));
}

// ---------- related products audit ----------

/** Related links that point at blocked or inactive products (legacy SA_related_products). */
export async function listBrokenRelated() {
  const db = getDb();
  const target = db.$with('t').as(db.select({ id: products.id, sku: products.sku, blockedReason: products.blockedReason, active: products.active }).from(products));
  return db
    .with(target)
    .select({ productId: relatedProducts.productId, productSku: sql<string>`(select sku from products p where p.id = ${relatedProducts.productId})`, relatedId: relatedProducts.relatedProductId, relatedSku: target.sku, blockedReason: target.blockedReason, relatedActive: target.active })
    .from(relatedProducts)
    .innerJoin(target, eq(target.id, relatedProducts.relatedProductId))
    .where(or(and(sql`coalesce(${target.blockedReason}, '') <> ''`, sql`${target.blockedReason} <> 'TEMPUNAVBL'`), eq(target.active, false)))
    .orderBy(asc(relatedProducts.relatedProductId), asc(relatedProducts.productId))
    .limit(1000);
}

export async function fixRelated(input: { action: 'remove' | 'replace' | 'bulk-remove' | 'bulk-replace'; productId?: number | null; relatedId: number; newId?: number | null }): Promise<number> {
  const db = getDb();
  if (input.action === 'remove' && input.productId) {
    await db.delete(relatedProducts).where(and(eq(relatedProducts.productId, input.productId), eq(relatedProducts.relatedProductId, input.relatedId)));
    return 1;
  }
  if (input.action === 'bulk-remove') {
    const r = await db.delete(relatedProducts).where(eq(relatedProducts.relatedProductId, input.relatedId)).returning({ p: relatedProducts.productId });
    return r.length;
  }
  if (!input.newId) throw new CatalogError('Enter the replacement product id.');
  const exists = await db.query.products.findFirst({ columns: { id: true }, where: eq(products.id, input.newId) });
  if (!exists) throw new CatalogError(`Product #${input.newId} does not exist.`);
  const rows = await db.select().from(relatedProducts).where(and(eq(relatedProducts.relatedProductId, input.relatedId), input.action === 'replace' && input.productId ? eq(relatedProducts.productId, input.productId) : undefined));
  let n = 0;
  for (const r of rows) {
    await db.delete(relatedProducts).where(and(eq(relatedProducts.productId, r.productId), eq(relatedProducts.relatedProductId, input.relatedId), eq(relatedProducts.kind, r.kind)));
    const dup = await db.select({ p: relatedProducts.productId }).from(relatedProducts).where(and(eq(relatedProducts.productId, r.productId), eq(relatedProducts.relatedProductId, input.newId), eq(relatedProducts.kind, r.kind))).limit(1);
    if (!dup[0] && r.productId !== input.newId) {
      await db.insert(relatedProducts).values({ productId: r.productId, relatedProductId: input.newId, kind: r.kind, sortOrder: r.sortOrder });
      n++;
    }
  }
  return n;
}

// ---------- appliance models ----------

export async function findModels(q: string, page = 1) {
  const db = getDb();
  const t = q.trim();
  const where = t ? or(eq(applianceModels.normalized, normalizeModelNumber(t)), like(applianceModels.modelNumber, `${t.toUpperCase()}%`), like(applianceModels.brandName, `%${t}%`)) : undefined;
  const [rows, [count]] = await Promise.all([
    db
      .select({ id: applianceModels.id, modelNumber: applianceModels.modelNumber, brandName: applianceModels.brandName, applianceType: applianceModels.applianceType, noindex: applianceModels.noindex, productCount: sql<number>`(select count(*) from model_products mp where mp.model_id = ${applianceModels.id})` })
      .from(applianceModels)
      .where(where)
      .orderBy(asc(applianceModels.modelNumber))
      .limit(PAGE_SIZE)
      .offset(offsetFor(page)),
    db.select({ n: sql<number>`count(*)` }).from(applianceModels).where(where),
  ]);
  return { rows, total: count?.n ?? 0, page, pageSize: PAGE_SIZE };
}

export async function getModelAdmin(id: number) {
  const db = getDb();
  const model = await db.query.applianceModels.findFirst({ where: eq(applianceModels.id, id) });
  if (!model) return null;
  const prods = await db
    .select({ id: products.id, sku: products.sku, name: products.name, active: products.active, relation: modelProducts.relation, sortOrder: modelProducts.sortOrder })
    .from(modelProducts)
    .innerJoin(products, eq(products.id, modelProducts.productId))
    .where(eq(modelProducts.modelId, id))
    .orderBy(asc(modelProducts.sortOrder), asc(products.sku));
  return { model, products: prods };
}

export async function saveModel(id: number, input: { modelNumber: string; brandName: string | null; applianceType: string | null; noindex: boolean }): Promise<void> {
  const number = input.modelNumber.trim().toUpperCase();
  if (!number) throw new CatalogError('Model number is required.');
  await getDb().update(applianceModels).set({ modelNumber: number, normalized: normalizeModelNumber(number), brandName: input.brandName?.trim() || null, applianceType: input.applianceType?.trim() || null, noindex: input.noindex }).where(eq(applianceModels.id, id));
}

export async function linkModelProduct(modelId: number, productId: number, relation: string, link: boolean): Promise<void> {
  const db = getDb();
  if (!link) {
    await db.delete(modelProducts).where(and(eq(modelProducts.modelId, modelId), eq(modelProducts.productId, productId)));
    return;
  }
  const p = await db.query.products.findFirst({ columns: { id: true }, where: eq(products.id, productId) });
  if (!p) throw new CatalogError(`Product #${productId} does not exist.`);
  const exists = await db.select({ m: modelProducts.modelId }).from(modelProducts).where(and(eq(modelProducts.modelId, modelId), eq(modelProducts.productId, productId))).limit(1);
  if (!exists[0]) await db.insert(modelProducts).values({ modelId, productId, relation });
}

export async function deleteModel(id: number): Promise<void> {
  await getDb().delete(applianceModels).where(eq(applianceModels.id, id));
}
