import { and, asc, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import {
  applianceModels, categories, categoryProducts, compatibleSkus, modelProducts, optionGroups, options, productImages, productOptionGroups,
  productOptions, productSpecs, products, quantityTiers, relatedProducts, reviews,
} from '@ff/db';
import { getDb } from './db';

export const PAGE_SIZE = 24;

const productCard = {
  id: products.id,
  sku: products.sku,
  name: products.name,
  slug: products.slug,
  brandName: products.brandName,
  priceCents: products.priceCents,
  listPriceCents: products.listPriceCents,
  asLowAsCents: products.asLowAsCents,
  thumbUrl: products.thumbUrl,
  imageUrl: products.imageUrl,
  stock: products.stock,
  ignoreStock: products.ignoreStock,
  freeShipping: products.freeShipping,
  privateLabel: products.privateLabel,
  popRank: products.popRank,
} as const;

export type ProductCard = Pick<typeof products.$inferSelect, keyof typeof productCard>;

/** Legacy listing rule: active, not discontinued, not blocked. */
const listable = and(eq(products.active, true), eq(products.hidden, false), ne(products.stock, -250), sql`coalesce(${products.blockedReason}, '') = ''`);
/** Legacy ordering: homepage priority, available first, then poprank, then stock desc. */
const availabilityRank = sql<number>`case when ${products.stock} > 0 or ${products.ignoreStock} = 1 then 0 else 1 end`;
const listingOrder = [asc(products.homePageRank), availabilityRank, asc(products.popRank), desc(products.stock)];

// ---------- categories ----------

export async function getCategoryBySlug(slug: string) {
  return getDb().query.categories.findFirst({ where: and(eq(categories.slug, slug), eq(categories.active, true)) });
}

export async function getCategoryChildren(categoryId: number) {
  return getDb()
    .select({ id: categories.id, name: categories.name, slug: categories.slug, imageUrl: categories.imageUrl, categoryType: categories.categoryType })
    .from(categories)
    .where(and(eq(categories.parentId, categoryId), eq(categories.active, true), eq(categories.hideFromListings, false)))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

/** Root → … → category, for breadcrumbs. The legacy root "Parent Categories" (id 1) is skipped. */
export async function getCategoryAncestors(category: { id: number; parentId: number | null }) {
  const chain: { id: number; name: string; slug: string }[] = [];
  let parentId = category.parentId;
  let guard = 0;
  while (parentId && parentId > 1 && guard++ < 8) {
    const row = await getDb().query.categories.findFirst({ columns: { id: true, name: true, slug: true, parentId: true }, where: eq(categories.id, parentId) });
    if (!row) break;
    chain.unshift({ id: row.id, name: row.name, slug: row.slug });
    parentId = row.parentId;
  }
  return chain;
}

export async function getCategoryProducts(categoryId: number, page = 1) {
  const db = getDb();
  const offset = (Math.max(1, page) - 1) * PAGE_SIZE;
  // Parent categories roll up their visible children (legacy prodlist4 behaviour).
  const childIds = (await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.parentId, categoryId), eq(categories.hideFromListings, false)))).map((c) => c.id);
  const scope = inArray(categoryProducts.categoryId, [categoryId, ...childIds]);
  const where = and(scope, listable);
  const [rows, [count]] = await Promise.all([
    db
      .selectDistinct(productCard)
      .from(categoryProducts)
      .innerJoin(products, eq(products.id, categoryProducts.productId))
      .where(where)
      .orderBy(...listingOrder)
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ n: sql<number>`count(distinct ${products.id})` })
      .from(categoryProducts)
      .innerJoin(products, eq(products.id, categoryProducts.productId))
      .where(where),
  ]);
  return { rows, total: count?.n ?? 0, page, pageSize: PAGE_SIZE };
}

export async function getFeaturedCategories() {
  return getDb()
    .select({ id: categories.id, name: categories.name, slug: categories.slug, imageUrl: categories.imageUrl })
    .from(categories)
    .where(and(eq(categories.active, true), eq(categories.featured, true), eq(categories.hideFromListings, false)))
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .limit(12);
}

// ---------- products ----------

export async function getProductBySlug(slug: string) {
  return getDb().query.products.findFirst({ where: eq(products.slug, slug) });
}

export async function getProductCategories(productId: number) {
  return getDb()
    .select({ id: categories.id, name: categories.name, slug: categories.slug, parentId: categories.parentId })
    .from(categoryProducts)
    .innerJoin(categories, eq(categories.id, categoryProducts.categoryId))
    .where(and(eq(categoryProducts.productId, productId), eq(categories.active, true), eq(categories.hideFromListings, false)))
    .limit(5);
}

export interface OptionGroupView {
  id: number;
  name: string;
  displayType: string;
  required: boolean;
  options: { id: number; label: string; priceAddCents: number; percentAdd: number; inStock: boolean; priceOverrideCents: number | null }[];
}

/** Option groups for a product (or its parent, legacy idPaired), with exclusions and per-option stock applied. */
export async function getProductOptions(productId: number, parentProductId: number | null): Promise<OptionGroupView[]> {
  const db = getDb();
  const owner = parentProductId ?? productId;
  const groups = await db
    .select({ id: optionGroups.id, name: optionGroups.name, displayType: optionGroups.displayType, required: optionGroups.required })
    .from(productOptionGroups)
    .innerJoin(optionGroups, eq(optionGroups.id, productOptionGroups.groupId))
    .where(eq(productOptionGroups.productId, owner))
    .orderBy(asc(productOptionGroups.sortOrder));
  if (!groups.length) return [];
  const opts = await db
    .select({ id: options.id, groupId: options.groupId, label: options.label, priceAddCents: options.priceAddCents, percentAdd: options.percentAdd, sortOrder: options.sortOrder })
    .from(options)
    .where(inArray(options.groupId, groups.map((g) => g.id)))
    .orderBy(asc(options.sortOrder), asc(options.id));
  const po = await db
    .select({ optionId: productOptions.optionId, stock: productOptions.stock, excluded: productOptions.excluded, priceOverrideCents: productOptions.priceOverrideCents })
    .from(productOptions)
    .where(or(eq(productOptions.productId, productId), eq(productOptions.productId, owner)));
  const poMap = new Map(po.map((p) => [p.optionId, p]));
  return groups.map((g) => ({
    ...g,
    options: opts
      .filter((o) => o.groupId === g.id && !poMap.get(o.id)?.excluded)
      .map((o) => {
        const p = poMap.get(o.id);
        return { id: o.id, label: o.label, priceAddCents: o.priceAddCents, percentAdd: o.percentAdd, inStock: p?.stock === null || p?.stock === undefined ? true : p.stock > 0, priceOverrideCents: p?.priceOverrideCents ?? null };
      }),
  }));
}

export async function getProductDetail(productId: number, parentProductId: number | null) {
  const db = getDb();
  const [images, specs, tiers, compat, related, modelCount, models, reviewStats] = await Promise.all([
    db.select({ url: productImages.url, alt: productImages.alt }).from(productImages).where(eq(productImages.productId, productId)).orderBy(asc(productImages.sortOrder)),
    db.select({ name: productSpecs.name, value: productSpecs.value }).from(productSpecs).where(eq(productSpecs.productId, productId)).orderBy(asc(productSpecs.sortOrder)),
    db.select({ fromQty: quantityTiers.fromQty, toQty: quantityTiers.toQty, discountCents: quantityTiers.discountCents, discountPercent: quantityTiers.discountPercent })
      .from(quantityTiers).where(and(eq(quantityTiers.productId, parentProductId ?? productId), sql`${quantityTiers.source} is null`)).orderBy(asc(quantityTiers.fromQty)),
    db.select({ brand: compatibleSkus.brand, sku: compatibleSkus.sku }).from(compatibleSkus).where(eq(compatibleSkus.productId, productId)).orderBy(asc(compatibleSkus.brand), asc(compatibleSkus.sku)).limit(200),
    db.select({ ...productCard, kind: relatedProducts.kind })
      .from(relatedProducts).innerJoin(products, eq(products.id, relatedProducts.relatedProductId))
      .where(and(eq(relatedProducts.productId, productId), listable)).orderBy(asc(relatedProducts.kind), asc(relatedProducts.sortOrder)).limit(12),
    db.select({ n: sql<number>`count(*)` }).from(modelProducts).where(eq(modelProducts.productId, productId)),
    db.select({ modelNumber: applianceModels.modelNumber, brandName: applianceModels.brandName })
      .from(modelProducts).innerJoin(applianceModels, eq(applianceModels.id, modelProducts.modelId))
      .where(eq(modelProducts.productId, productId)).orderBy(asc(applianceModels.brandName), asc(applianceModels.modelNumber)).limit(300),
    db.select({ n: sql<number>`count(*)`, avg: sql<number>`avg(${reviews.rating})` }).from(reviews).where(and(eq(reviews.productId, productId), eq(reviews.approved, true))),
  ]);
  return { images, specs, tiers, compat, related, modelCount: modelCount[0]?.n ?? 0, models, reviewCount: reviewStats[0]?.n ?? 0, reviewAvg: reviewStats[0]?.avg ?? null };
}

export async function getProductReviews(productId: number, limit = 10) {
  return getDb()
    .select({ id: reviews.id, rating: reviews.rating, title: reviews.title, body: reviews.body, authorName: reviews.authorName, createdAt: reviews.createdAt })
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.approved, true)))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

export async function getProductsByIds(ids: number[]) {
  if (!ids.length) return [];
  return getDb().select(productCard).from(products).where(and(inArray(products.id, ids), listable));
}

export async function getCategoryById(id: number) {
  return getDb().query.categories.findFirst({ columns: { id: true, name: true, slug: true }, where: eq(categories.id, id) });
}

// ---------- models ----------

export async function getModel(modelNumber: string) {
  const db = getDb();
  const model = await db.query.applianceModels.findFirst({ where: sql`upper(${applianceModels.modelNumber}) = upper(${modelNumber})` });
  if (!model) return null;
  const items = await db
    .select(productCard)
    .from(modelProducts)
    .innerJoin(products, eq(products.id, modelProducts.productId))
    .where(and(eq(modelProducts.modelId, model.id), listable))
    .orderBy(asc(modelProducts.sortOrder), ...listingOrder)
    .limit(48);
  return { model, products: items };
}

export async function getPopularProducts(limit = 8) {
  return getDb()
    .select(productCard)
    .from(products)
    .where(and(listable, sql`${products.stock} > 0`))
    .orderBy(asc(products.popRank))
    .limit(limit);
}
