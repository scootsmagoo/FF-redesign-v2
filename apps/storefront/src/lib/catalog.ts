import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { applianceModels, categories, categoryProducts, modelProducts, products } from '@ff/db';
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

/** Legacy ordering: available first, then poprank, then stock desc. */
const availabilityRank = sql<number>`case when ${products.stock} > 0 or ${products.ignoreStock} = 1 then 0 else 1 end`;

export async function getCategoryBySlug(slug: string) {
  const db = getDb();
  return db.query.categories.findFirst({ where: and(eq(categories.slug, slug), eq(categories.active, true)) });
}

export async function getCategoryProducts(categoryId: number, page = 1) {
  const db = getDb();
  const offset = (Math.max(1, page) - 1) * PAGE_SIZE;
  const [rows, [count]] = await Promise.all([
    db
      .select(productCard)
      .from(categoryProducts)
      .innerJoin(products, eq(products.id, categoryProducts.productId))
      .where(and(eq(categoryProducts.categoryId, categoryId), eq(products.active, true), eq(products.hidden, false)))
      .orderBy(availabilityRank, asc(products.popRank), desc(products.stock))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ n: sql<number>`count(*)` })
      .from(categoryProducts)
      .innerJoin(products, eq(products.id, categoryProducts.productId))
      .where(and(eq(categoryProducts.categoryId, categoryId), eq(products.active, true), eq(products.hidden, false))),
  ]);
  return { rows, total: count?.n ?? 0, page, pageSize: PAGE_SIZE };
}

export async function getProductBySlug(slug: string) {
  const db = getDb();
  return db.query.products.findFirst({ where: eq(products.slug, slug) });
}

export async function getProductCategories(productId: number) {
  const db = getDb();
  return db
    .select({ id: categories.id, name: categories.name, slug: categories.slug, parentId: categories.parentId })
    .from(categoryProducts)
    .innerJoin(categories, eq(categories.id, categoryProducts.categoryId))
    .where(and(eq(categoryProducts.productId, productId), eq(categories.active, true)))
    .limit(5);
}

export async function getModel(modelNumber: string) {
  const db = getDb();
  const model = await db.query.applianceModels.findFirst({
    where: sql`upper(${applianceModels.modelNumber}) = upper(${modelNumber})`,
  });
  if (!model) return null;
  const links = await db
    .select({ productId: modelProducts.productId })
    .from(modelProducts)
    .where(eq(modelProducts.modelId, model.id))
    .orderBy(asc(modelProducts.sortOrder));
  const ids = links.map((l) => l.productId);
  const items = ids.length
    ? await db.select(productCard).from(products).where(and(inArray(products.id, ids), eq(products.active, true)))
    : [];
  return { model, products: items };
}

export async function getFeaturedCategories() {
  const db = getDb();
  return db
    .select({ id: categories.id, name: categories.name, slug: categories.slug, imageUrl: categories.imageUrl })
    .from(categories)
    .where(eq(categories.active, true))
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .limit(6);
}

export async function getPopularProducts(limit = 8) {
  const db = getDb();
  return db
    .select(productCard)
    .from(products)
    .where(and(eq(products.active, true), eq(products.hidden, false), sql`${products.stock} > 0`))
    .orderBy(asc(products.popRank))
    .limit(limit);
}
