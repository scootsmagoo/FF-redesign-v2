import { and, asc, desc, eq, inArray, isNull, like, or, sql } from 'drizzle-orm';
import {
  applianceModels,
  brands,
  categories,
  categoryProducts,
  compatibleSkus,
  faqs,
  modelProducts,
  optionGroups,
  options,
  productCompareSpecs,
  productImages,
  productOptionGroups,
  productOptions,
  productPriceChangelog,
  productSpecs,
  products,
  quantityTiers,
  relatedProducts,
  saleRestrictions,
} from '@ff/db';
import { normalizeModelNumber, normalizePartNumber } from '@ff/domain/models';
import { slugify } from '@ff/domain/urls';
import { getDb } from '../db';
import { offsetFor, PAGE_SIZE } from './util';

/**
 * Product management for the manager (legacy SA_prod.asp, SA_prod_edit.asp, SA_prod_exec.asp,
 * SA_CompSKUManager.asp, SendModelRequest.asp). Every write goes through here.
 */

/** Product ids exempt from parent → child price propagation, as on the legacy site. */
export const PROPAGATION_EXEMPT = new Set([2278, 2279]);
export const STOCK_DISCONTINUED = -250;
export const STOCK_SPECIAL_ORDER = -150;

export const SORTS = {
  poprank: [asc(products.popRank), asc(products.name)],
  name: [asc(products.name)],
  sku: [asc(products.sku)],
  price: [asc(products.priceCents)],
  stock: [asc(products.stock)],
  'id-asc': [asc(products.id)],
  'id-desc': [desc(products.id)],
} as const;
export type SortKey = keyof typeof SORTS;

export interface ProductListFilter {
  q?: string;
  /** name | sku: "starts with" letter filter target */
  field?: 'name' | 'sku';
  start?: string;
  /** category id; 0 = products in no category */
  categoryId?: number | null;
  active?: boolean | null;
  featured?: boolean | null;
  special?: boolean | null;
  freeShip?: boolean | null;
  paired?: 'parent' | 'child' | 'standalone' | null;
  stockState?: 'in' | 'out' | 'discontinued' | 'special' | null;
  sort?: SortKey;
  page?: number;
}

export async function listProductsAdmin(f: ProductListFilter) {
  const db = getDb();
  const q = (f.q ?? '').trim();
  const conds = [];
  if (q) {
    const p = `%${q}%`;
    const upc = q.replace(/[-\s]/g, '');
    conds.push(
      or(
        like(products.name, p),
        like(products.sku, p),
        like(products.shortDescription, p),
        like(products.manufacturerSku, p),
        sql`replace(replace(coalesce(${products.upc}, ''), '-', ''), ' ', '') = ${upc}`,
        /^\d+$/.test(q) ? eq(products.id, Number(q)) : undefined,
        sql`exists (select 1 from compatible_skus cs where cs.product_id = ${products.id} and cs.sku_normalized = ${normalizePartNumber(q)})`,
      ),
    );
  }
  if (f.start) {
    const col = f.field === 'sku' ? products.sku : products.name;
    conds.push(f.start === '0-9' ? sql`substr(${col}, 1, 1) between '0' and '9'` : like(col, `${f.start}%`));
  }
  if (f.categoryId === 0) conds.push(sql`not exists (select 1 from category_products cp where cp.product_id = ${products.id})`);
  else if (f.categoryId) conds.push(sql`exists (select 1 from category_products cp where cp.product_id = ${products.id} and cp.category_id = ${f.categoryId})`);
  if (f.active !== null && f.active !== undefined) conds.push(eq(products.active, f.active));
  if (f.featured !== null && f.featured !== undefined) conds.push(f.featured ? sql`${products.homePageRank} > 0` : eq(products.homePageRank, 0));
  if (f.special !== null && f.special !== undefined) conds.push(eq(products.hotDeal, f.special));
  if (f.freeShip !== null && f.freeShip !== undefined) conds.push(eq(products.freeShipping, f.freeShip));
  if (f.paired === 'child') conds.push(sql`${products.parentProductId} is not null`);
  if (f.paired === 'parent') conds.push(sql`exists (select 1 from products c where c.parent_product_id = ${products.id})`);
  if (f.paired === 'standalone') conds.push(and(isNull(products.parentProductId), sql`not exists (select 1 from products c where c.parent_product_id = ${products.id})`));
  if (f.stockState === 'in') conds.push(or(sql`${products.stock} > 0`, eq(products.ignoreStock, true)));
  if (f.stockState === 'out') conds.push(and(sql`${products.stock} <= 0`, eq(products.ignoreStock, false), sql`${products.stock} not in (${STOCK_DISCONTINUED}, ${STOCK_SPECIAL_ORDER})`));
  if (f.stockState === 'discontinued') conds.push(eq(products.stock, STOCK_DISCONTINUED));
  if (f.stockState === 'special') conds.push(eq(products.stock, STOCK_SPECIAL_ORDER));
  const where = conds.length ? and(...conds) : undefined;
  const page = Math.max(1, f.page ?? 1);
  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        slug: products.slug,
        upc: products.upc,
        priceCents: products.priceCents,
        stock: products.stock,
        actualInventory: products.actualInventory,
        ignoreStock: products.ignoreStock,
        active: products.active,
        parentProductId: products.parentProductId,
        popRank: products.popRank,
        blockedReason: products.blockedReason,
        thumbUrl: products.thumbUrl,
      })
      .from(products)
      .where(where)
      .orderBy(...SORTS[f.sort ?? 'poprank'])
      .limit(PAGE_SIZE)
      .offset(offsetFor(page)),
    db.select({ n: sql<number>`count(*)` }).from(products).where(where),
  ]);
  return { rows, total: count?.n ?? 0, page, pageSize: PAGE_SIZE };
}

/** Quick lookup for pickers: by id, SKU or name fragment. */
export async function searchProductsQuick(q: string, limit = 20) {
  const db = getDb();
  const t = q.trim();
  if (!t) return [];
  const p = `%${t}%`;
  return db
    .select({ id: products.id, sku: products.sku, name: products.name, active: products.active, parentProductId: products.parentProductId })
    .from(products)
    .where(or(/^\d+$/.test(t) ? eq(products.id, Number(t)) : undefined, like(products.sku, p), like(products.name, p)))
    .orderBy(asc(products.popRank))
    .limit(limit);
}

// ---------- detail ----------

export async function getProductAdmin(id: number) {
  const db = getDb();
  const product = await db.query.products.findFirst({ where: eq(products.id, id) });
  if (!product) return null;
  const owner = product.parentProductId ?? product.id;
  const [cats, images, specs, tiers, xrefs, models, compare, related, restrictions, children, parent, faqCount, priceLog, groups, brandRows] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name, parentId: categories.parentId, categoryType: categories.categoryType, sortOrder: categoryProducts.sortOrder })
      .from(categoryProducts)
      .innerJoin(categories, eq(categories.id, categoryProducts.categoryId))
      .where(eq(categoryProducts.productId, id))
      .orderBy(asc(categories.name)),
    db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.sortOrder)),
    db.select().from(productSpecs).where(eq(productSpecs.productId, id)).orderBy(asc(productSpecs.sortOrder), asc(productSpecs.id)),
    db.select().from(quantityTiers).where(and(eq(quantityTiers.productId, owner), isNull(quantityTiers.source))).orderBy(asc(quantityTiers.fromQty)),
    db.select().from(compatibleSkus).where(eq(compatibleSkus.productId, id)).orderBy(asc(compatibleSkus.brand), asc(compatibleSkus.sku)),
    db
      .select({ modelId: applianceModels.id, modelNumber: applianceModels.modelNumber, brandName: applianceModels.brandName, applianceType: applianceModels.applianceType, relation: modelProducts.relation })
      .from(modelProducts)
      .innerJoin(applianceModels, eq(applianceModels.id, modelProducts.modelId))
      .where(eq(modelProducts.productId, id))
      .orderBy(asc(applianceModels.brandName), asc(applianceModels.modelNumber))
      .limit(2000),
    db.query.productCompareSpecs.findFirst({ where: eq(productCompareSpecs.productId, id) }),
    db
      .select({ id: products.id, sku: products.sku, name: products.name, kind: relatedProducts.kind, sortOrder: relatedProducts.sortOrder, active: products.active, blockedReason: products.blockedReason })
      .from(relatedProducts)
      .innerJoin(products, eq(products.id, relatedProducts.relatedProductId))
      .where(eq(relatedProducts.productId, id))
      .orderBy(asc(relatedProducts.kind), asc(relatedProducts.sortOrder)),
    db.select().from(saleRestrictions).where(eq(saleRestrictions.productId, id)).orderBy(asc(saleRestrictions.country), asc(saleRestrictions.region)),
    db.select({ id: products.id, sku: products.sku, name: products.name, active: products.active }).from(products).where(eq(products.parentProductId, id)).orderBy(asc(products.sku)),
    product.parentProductId ? db.query.products.findFirst({ columns: { id: true, sku: true, name: true }, where: eq(products.id, product.parentProductId) }) : Promise.resolve(null),
    db.select({ n: sql<number>`count(*)` }).from(faqs).where(and(eq(faqs.scope, 'product'), eq(faqs.scopeId, id))),
    db.select().from(productPriceChangelog).where(eq(productPriceChangelog.productId, id)).orderBy(desc(productPriceChangelog.id)).limit(50),
    getProductOptionGroupsAdmin(id, owner),
    db.select({ id: brands.id, name: brands.name }).from(brands).where(eq(brands.active, true)).orderBy(asc(brands.name)),
  ]);
  return { product, categories: cats, images, specs, tiers, xrefs, models, compare: compare ?? null, related, restrictions, children, parent: parent ?? null, faqCount: faqCount[0]?.n ?? 0, priceLog, optionGroups: groups, brands: brandRows };
}

export async function getProductOptionGroupsAdmin(productId: number, owner: number) {
  const db = getDb();
  const groups = await db
    .select({ groupId: optionGroups.id, name: optionGroups.name, displayType: optionGroups.displayType, required: optionGroups.required, sortOrder: productOptionGroups.sortOrder })
    .from(productOptionGroups)
    .innerJoin(optionGroups, eq(optionGroups.id, productOptionGroups.groupId))
    .where(eq(productOptionGroups.productId, owner))
    .orderBy(asc(productOptionGroups.sortOrder));
  if (!groups.length) return [];
  const opts = await db
    .select({ id: options.id, groupId: options.groupId, label: options.label, priceAddCents: options.priceAddCents, percentAdd: options.percentAdd, sortOrder: options.sortOrder })
    .from(options)
    .where(inArray(options.groupId, groups.map((g) => g.groupId)))
    .orderBy(asc(options.sortOrder), asc(options.label));
  const po = await db.select().from(productOptions).where(or(eq(productOptions.productId, productId), eq(productOptions.productId, owner)));
  const poMap = new Map<number, (typeof po)[number]>();
  for (const r of po) if (!poMap.has(r.optionId) || r.productId === productId) poMap.set(r.optionId, r);
  return groups.map((g) => ({ ...g, options: opts.filter((o) => o.groupId === g.groupId).map((o) => ({ ...o, product: poMap.get(o.id) ?? null })) }));
}

export async function listOptionGroupsForPicker() {
  return getDb()
    .select({ id: optionGroups.id, name: optionGroups.name, displayType: optionGroups.displayType, optionCount: sql<number>`(select count(*) from options o where o.group_id = ${optionGroups.id})` })
    .from(optionGroups)
    .orderBy(asc(optionGroups.name));
}

// ---------- save ----------

export interface ProductInput {
  sku: string;
  name: string;
  slug?: string | null;
  brandName?: string | null;
  manufacturerSku?: string | null;
  upc?: string | null;
  active: boolean;
  hidden: boolean;
  searchable: boolean;
  priceCents: number;
  listPriceCents?: number | null;
  mapCents?: number | null;
  costCents?: number | null;
  ogPriceCents?: number | null;
  dimFeeCents?: number | null;
  weightOz?: number | null;
  stock?: number | null;
  ignoreStock: boolean;
  leadTimeDays?: number | null;
  dropShip: boolean;
  blockedReason?: string | null;
  hotDeal: boolean;
  homePageRank?: number | null;
  freeShipping: boolean;
  discountedShipping: boolean;
  freeProduct: boolean;
  giftWithPurchaseId?: number | null;
  prop65: boolean;
  madeInUsa: boolean;
  taxExempt: boolean;
  privateLabel: boolean;
  hidePrice: boolean;
  guaranteeBadge: boolean;
  showUnaffiliated: boolean;
  includeInFeed: boolean;
  feedOverride: boolean;
  autoshipEnabled: boolean;
  recommendedFrequencyMonths?: number | null;
  returnPolicyCode: number;
  packQty?: number | null;
  packSize?: number | null;
  packUom?: string | null;
  maxCartQty?: number | null;
  familyDesignation?: string | null;
  parentProductId?: number | null;
  compareToId?: number | null;
  compareToAltId?: number | null;
  compareSortOrder: number;
  compareDefaultOptionId?: number | null;
  replacementForId?: number | null;
  recommendedProductId?: number | null;
  discontinuedAlternativeId?: number | null;
  discontinuedAlternativeKind?: string | null;
  discontinuedText?: string | null;
  tempUnavailableAlternativeId?: number | null;
  tempUnavailableText?: string | null;
  isFridgeFilter: boolean;
  isFfAirFilter: boolean;
  isFfWaterFilter: boolean;
  isHumidifierFilter: boolean;
  isHomeAirFilter: boolean;
  googleCategory?: string | null;
  navItemNo?: string | null;
  // content
  descriptionHtml?: string | null;
  shortDescription?: string | null;
  searchKeywords?: string | null;
  comparisonText?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  imageUrl?: string | null;
  thumbUrl?: string | null;
}

export class ProductError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

async function validateProduct(input: ProductInput, id: number | null): Promise<{ slug: string }> {
  const db = getDb();
  if (!input.sku.trim()) throw new ProductError('SKU is required.', 'sku');
  if (!input.name.trim()) throw new ProductError('Product name is required.', 'name');
  if (input.priceCents < 0) throw new ProductError('Price cannot be negative.', 'price');
  if (input.mapCents && input.priceCents < input.mapCents) throw new ProductError(`Price is below the minimum advertised price (${(input.mapCents / 100).toFixed(2)}).`, 'price');
  if ((input.shortDescription ?? '').length > 250) throw new ProductError('Long description must be 250 characters or fewer.', 'shortDescription');
  const dupSku = await db.select({ id: products.id }).from(products).where(sql`upper(${products.sku}) = upper(${input.sku.trim()})`).limit(1);
  if (dupSku[0] && dupSku[0].id !== id) throw new ProductError(`SKU "${input.sku}" already belongs to product #${dupSku[0].id}.`, 'sku');
  let slug = (input.slug ?? '').trim() || slugify(input.name);
  slug = slugify(slug);
  if (!slug) throw new ProductError('URL slug is required.', 'slug');
  const dupSlug = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug)).limit(1);
  if (dupSlug[0] && dupSlug[0].id !== id) throw new ProductError(`A product with URL "/p/${slug}" already exists (#${dupSlug[0].id}).`, 'slug');
  if (input.parentProductId) {
    if (input.parentProductId === id) throw new ProductError('A product cannot be its own parent.', 'parentProductId');
    const parent = await db.query.products.findFirst({ columns: { id: true, parentProductId: true }, where: eq(products.id, input.parentProductId) });
    if (!parent) throw new ProductError(`Parent product #${input.parentProductId} does not exist.`, 'parentProductId');
    if (parent.parentProductId) throw new ProductError('The parent is itself a child product; choose its parent instead.', 'parentProductId');
  }
  if (input.compareToId && input.compareToId !== id) {
    const other = await db.query.products.findFirst({ columns: { id: true }, where: eq(products.id, input.compareToId) });
    if (!other) throw new ProductError(`Compare-to product #${input.compareToId} does not exist.`, 'compareToId');
  }
  const maxTier = id ? await db.select({ m: sql<number>`coalesce(max(discount_cents), 0)` }).from(quantityTiers).where(eq(quantityTiers.productId, id)) : [{ m: 0 }];
  if ((maxTier[0]?.m ?? 0) > input.priceCents) throw new ProductError('Price cannot be less than the largest quantity-tier discount.', 'price');
  return { slug };
}

function toRow(input: ProductInput, slug: string): Partial<typeof products.$inferInsert> {
  const brandName = input.brandName?.trim() || null;
  return {
    sku: input.sku.trim(),
    name: input.name.trim(),
    slug,
    brandName,
    manufacturerSku: input.manufacturerSku?.trim() || null,
    upc: input.upc?.trim() || null,
    active: input.active,
    hidden: input.hidden,
    searchable: input.searchable,
    priceCents: input.priceCents,
    listPriceCents: input.listPriceCents ?? null,
    mapCents: input.mapCents ?? null,
    costCents: input.costCents ?? null,
    ogPriceCents: input.ogPriceCents || null,
    dimFeeCents: input.dimFeeCents ?? null,
    weightOz: input.weightOz ?? null,
    ignoreStock: input.ignoreStock,
    leadTimeDays: input.leadTimeDays ?? null,
    dropShip: input.dropShip,
    blockedReason: input.blockedReason?.trim() || null,
    hotDeal: input.hotDeal,
    homePageRank: input.homePageRank ?? 0,
    freeShipping: input.freeShipping,
    discountedShipping: input.discountedShipping,
    freeProduct: input.freeProduct,
    giftWithPurchaseId: input.giftWithPurchaseId || null,
    prop65: input.prop65,
    madeInUsa: input.madeInUsa,
    taxExempt: input.taxExempt,
    privateLabel: input.privateLabel,
    hidePrice: input.hidePrice,
    guaranteeBadge: input.guaranteeBadge,
    showUnaffiliated: input.showUnaffiliated,
    includeInFeed: input.includeInFeed,
    feedOverride: input.feedOverride,
    autoshipEnabled: input.autoshipEnabled,
    recommendedFrequencyMonths: input.recommendedFrequencyMonths ?? null,
    returnPolicyCode: input.returnPolicyCode,
    packQty: input.packQty && input.packQty > 0 ? input.packQty : 1,
    packSize: input.packSize ?? null,
    packUom: input.packUom?.trim() || null,
    maxCartQty: input.maxCartQty || null,
    familyDesignation: input.familyDesignation || null,
    parentProductId: input.parentProductId || null,
    compareToId: input.compareToId || null,
    compareToAltId: input.compareToAltId || null,
    compareSortOrder: input.compareSortOrder === 2 ? 2 : 1,
    compareDefaultOptionId: input.compareDefaultOptionId || null,
    replacementForId: input.replacementForId || null,
    recommendedProductId: input.recommendedProductId || null,
    discontinuedAlternativeId: input.discontinuedAlternativeId || null,
    discontinuedAlternativeKind: input.discontinuedAlternativeId ? (input.discontinuedAlternativeKind === 'category' ? 'category' : 'product') : null,
    discontinuedText: input.discontinuedText?.trim() || null,
    tempUnavailableAlternativeId: input.tempUnavailableAlternativeId || null,
    tempUnavailableText: input.tempUnavailableText?.trim() || null,
    isFridgeFilter: input.isFridgeFilter,
    isFfAirFilter: input.isFfAirFilter,
    isFfWaterFilter: input.isFfWaterFilter,
    isHumidifierFilter: input.isHumidifierFilter,
    isHomeAirFilter: input.isHomeAirFilter,
    googleCategory: input.googleCategory?.trim() || null,
    navItemNo: input.navItemNo?.trim() || null,
    descriptionHtml: input.descriptionHtml ?? null,
    shortDescription: input.shortDescription?.trim() || null,
    searchKeywords: input.searchKeywords?.trim() || null,
    comparisonText: input.comparisonText?.trim() || null,
    metaTitle: input.metaTitle?.trim() || null,
    metaDescription: input.metaDescription?.trim() || null,
    metaKeywords: input.metaKeywords?.trim() || null,
    imageUrl: input.imageUrl?.trim() || null,
    thumbUrl: input.thumbUrl?.trim() || null,
    updatedAt: new Date().toISOString(),
  };
}

/** Level-1 save of every editable column. Logs price changes and propagates parent prices to children as the legacy exec did. */
export async function updateProduct(id: number, input: ProductInput, adminEmail: string): Promise<void> {
  const db = getDb();
  const before = await db.query.products.findFirst({ where: eq(products.id, id) });
  if (!before) throw new ProductError('Product not found.');
  const { slug } = await validateProduct(input, id);
  const row = toRow(input, slug);
  if (input.stock !== null && input.stock !== undefined) row.stock = input.stock;
  // brand id follows the brand name when a brand row exists
  if (row.brandName) {
    const b = await db.select({ id: brands.id }).from(brands).where(sql`lower(${brands.name}) = lower(${row.brandName})`).limit(1);
    row.brandId = b[0]?.id ?? null;
  } else row.brandId = null;
  await db.update(products).set(row).where(eq(products.id, id));
  if (before.priceCents !== input.priceCents) {
    await db.insert(productPriceChangelog).values({ productId: id, prevPriceCents: before.priceCents, newPriceCents: input.priceCents, adminEmail });
  }
  await propagateToChildren(id, { priceCents: input.priceCents, listPriceCents: row.listPriceCents ?? null, costCents: row.costCents ?? null, feedOverride: input.feedOverride, ogPriceCents: row.ogPriceCents ?? null, recommendedFrequencyMonths: row.recommendedFrequencyMonths ?? null, returnPolicyCode: input.returnPolicyCode, imageUrl: row.imageUrl ?? null, thumbUrl: row.thumbUrl ?? null });
}

/** Restricted (level 2) save: price, list price, cost only. */
export async function updateProductPricing(id: number, p: { priceCents: number; listPriceCents: number | null; costCents: number | null }, adminEmail: string): Promise<void> {
  const db = getDb();
  const before = await db.query.products.findFirst({ where: eq(products.id, id) });
  if (!before) throw new ProductError('Product not found.');
  if (before.mapCents && p.priceCents < before.mapCents) throw new ProductError('Price is below the minimum advertised price.', 'price');
  await db.update(products).set({ priceCents: p.priceCents, listPriceCents: p.listPriceCents, costCents: p.costCents, updatedAt: new Date().toISOString() }).where(eq(products.id, id));
  if (before.priceCents !== p.priceCents) await db.insert(productPriceChangelog).values({ productId: id, prevPriceCents: before.priceCents, newPriceCents: p.priceCents, adminEmail });
  await propagateToChildren(id, { priceCents: p.priceCents, listPriceCents: p.listPriceCents, costCents: p.costCents });
}

async function propagateToChildren(parentId: number, values: Partial<typeof products.$inferInsert>) {
  const db = getDb();
  const kids = await db.select({ id: products.id }).from(products).where(eq(products.parentProductId, parentId));
  const ids = kids.map((k) => k.id).filter((k) => !PROPAGATION_EXEMPT.has(k));
  if (!ids.length) return;
  await db.update(products).set({ ...values, updatedAt: new Date().toISOString() }).where(inArray(products.id, ids));
}

export async function createProduct(input: ProductInput, adminEmail: string): Promise<number> {
  const db = getDb();
  const { slug } = await validateProduct(input, null);
  const row = toRow(input, slug);
  const [max] = await db.select({ m: sql<number>`coalesce(max(id), 0)` }).from(products);
  const id = (max?.m ?? 0) + 1; // legacy ids are reused as PKs, so new ones continue the sequence
  await db.insert(products).values({ ...(row as typeof products.$inferInsert), id, stock: input.stock ?? 0, popRank: 9999 });
  await db.insert(productPriceChangelog).values({ productId: id, prevPriceCents: null, newPriceCents: input.priceCents, adminEmail, tierChanges: 'created' });
  return id;
}

/** Copies a product (legacy "Copy"): new SKU/slug, same content, categories, tiers, specs and cross-refs. */
export async function copyProduct(sourceId: number, sku: string, name: string, adminEmail: string): Promise<number> {
  const db = getDb();
  const src = await db.query.products.findFirst({ where: eq(products.id, sourceId) });
  if (!src) throw new ProductError('Source product not found.');
  const { id: _id, createdAt: _c, updatedAt: _u, slug: _s, ...rest } = src;
  const input = { ...rest, sku, name, slug: slugify(name) } as unknown as ProductInput;
  const id = await createProduct({ ...input, stock: 0 }, adminEmail);
  const [cats, tiers, specs, xrefs] = await Promise.all([
    db.select().from(categoryProducts).where(eq(categoryProducts.productId, sourceId)),
    db.select().from(quantityTiers).where(eq(quantityTiers.productId, sourceId)),
    db.select().from(productSpecs).where(eq(productSpecs.productId, sourceId)),
    db.select().from(compatibleSkus).where(eq(compatibleSkus.productId, sourceId)),
  ]);
  if (cats.length) await db.insert(categoryProducts).values(cats.map((c) => ({ categoryId: c.categoryId, productId: id, sortOrder: c.sortOrder })));
  if (tiers.length) await db.insert(quantityTiers).values(tiers.map((t) => ({ productId: id, fromQty: t.fromQty, toQty: t.toQty, discountCents: t.discountCents, discountPercent: t.discountPercent, source: t.source })));
  if (specs.length) await db.insert(productSpecs).values(specs.map((s) => ({ productId: id, name: s.name, value: s.value, sortOrder: s.sortOrder })));
  if (xrefs.length) await db.insert(compatibleSkus).values(xrefs.map((x) => ({ productId: id, brand: x.brand, sku: x.sku, skuNormalized: x.skuNormalized })));
  return id;
}

/** Deletes the product; FK cascades remove images, options, tiers, specs, cross-refs, model links, restrictions, compare specs and category links. */
export async function deleteProduct(id: number): Promise<void> {
  const db = getDb();
  const kids = await db.select({ id: products.id }).from(products).where(eq(products.parentProductId, id));
  if (kids.length) throw new ProductError(`This product has ${kids.length} child product(s). Re-parent or delete them first.`);
  await db.delete(relatedProducts).where(or(eq(relatedProducts.productId, id), eq(relatedProducts.relatedProductId, id)));
  await db.delete(faqs).where(and(eq(faqs.scope, 'product'), eq(faqs.scopeId, id)));
  await db.delete(products).where(eq(products.id, id));
}

// ---------- categories ----------

export async function setProductCategories(productId: number, categoryIds: number[]): Promise<void> {
  const db = getDb();
  const ids = [...new Set(categoryIds.filter((n) => Number.isInteger(n) && n > 0))];
  await db.delete(categoryProducts).where(eq(categoryProducts.productId, productId));
  if (ids.length) {
    const valid = await db.select({ id: categories.id }).from(categories).where(inArray(categories.id, ids));
    if (valid.length) await db.insert(categoryProducts).values(valid.map((c, i) => ({ categoryId: c.id, productId, sortOrder: i })));
  }
}

/** Leaf categories grouped by parent, for the category picker. */
export async function listCategoriesForPicker() {
  const db = getDb();
  const rows = await db
    .select({ id: categories.id, name: categories.name, parentId: categories.parentId, categoryType: categories.categoryType, active: categories.active })
    .from(categories)
    .orderBy(asc(categories.name));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return rows.map((r) => ({ ...r, parentName: r.parentId ? (byId.get(r.parentId)?.name ?? '') : '' }));
}

// ---------- images ----------

export async function setProductImages(productId: number, urls: string[]): Promise<void> {
  const db = getDb();
  await db.delete(productImages).where(eq(productImages.productId, productId));
  const clean = urls.map((u) => u.trim()).filter(Boolean);
  if (clean.length) await db.insert(productImages).values(clean.map((url, i) => ({ productId, url, sortOrder: i + 1 })));
}

// ---------- specs (name/value rows) ----------

export async function setProductSpecs(productId: number, rows: { name: string; value: string }[]): Promise<void> {
  const db = getDb();
  await db.delete(productSpecs).where(eq(productSpecs.productId, productId));
  const clean = rows.map((r) => ({ name: r.name.trim(), value: r.value.trim() })).filter((r) => r.name && r.value);
  if (clean.length) await db.insert(productSpecs).values(clean.map((r, i) => ({ productId, name: r.name, value: r.value, sortOrder: i })));
}

// ---------- quantity tiers ----------

export interface TierInput {
  fromQty: number;
  toQty: number | null;
  discountCents: number;
  discountPercent: number;
}

export function validateTiers(tiers: TierInput[], priceCents: number): string | null {
  const sorted = [...tiers].sort((a, b) => a.fromQty - b.fromQty);
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i]!;
    if (!Number.isInteger(t.fromQty) || t.fromQty < 1) return `Tier ${i + 1}: "from" quantity must be 1 or more.`;
    if (t.toQty !== null && t.toQty < t.fromQty) return `Tier ${i + 1}: "to" quantity must be at least the "from" quantity.`;
    if (t.discountCents <= 0 && t.discountPercent <= 0) return `Tier ${i + 1}: enter a discount amount or a percentage.`;
    if (t.discountCents >= priceCents) return `Tier ${i + 1}: the discount amount must be less than the price.`;
    const next = sorted[i + 1];
    if (next && (t.toQty === null || next.fromQty <= t.toQty)) return `Tiers ${i + 1} and ${i + 2} overlap.`;
  }
  return null;
}

/** Replaces the tiers on the product (or its parent, which owns tiers for paired SKUs) and logs the change. */
export async function setQuantityTiers(productId: number, tiers: TierInput[], adminEmail: string): Promise<void> {
  const db = getDb();
  const p = await db.query.products.findFirst({ columns: { id: true, priceCents: true, parentProductId: true }, where: eq(products.id, productId) });
  if (!p) throw new ProductError('Product not found.');
  const owner = p.parentProductId ?? p.id;
  const problem = validateTiers(tiers, p.priceCents);
  if (problem) throw new ProductError(problem, 'tiers');
  const before = await db.select().from(quantityTiers).where(and(eq(quantityTiers.productId, owner), isNull(quantityTiers.source)));
  const fmt = (t: { fromQty: number; toQty: number | null; discountCents: number; discountPercent: number }[]) => t.map((x) => `${x.fromQty}|${x.toQty ?? ''}|${x.discountCents}|${x.discountPercent}`).join('~');
  await db.delete(quantityTiers).where(and(eq(quantityTiers.productId, owner), isNull(quantityTiers.source)));
  if (tiers.length) await db.insert(quantityTiers).values(tiers.map((t) => ({ productId: owner, fromQty: t.fromQty, toQty: t.toQty, discountCents: t.discountCents, discountPercent: t.discountPercent, source: null })));
  if (fmt(before) !== fmt(tiers)) await db.insert(productPriceChangelog).values({ productId: owner, adminEmail, tierChanges: `${fmt(before)}*${fmt(tiers)}` });
}

// ---------- cross-reference part numbers ----------

export async function addCompatibleSkus(productId: number, rows: { brand: string; sku: string }[]): Promise<number> {
  const db = getDb();
  const existing = await db.select({ norm: compatibleSkus.skuNormalized }).from(compatibleSkus).where(eq(compatibleSkus.productId, productId));
  const have = new Set(existing.map((e) => e.norm));
  const fresh = rows
    .map((r) => ({ brand: r.brand.trim(), sku: r.sku.trim(), skuNormalized: normalizePartNumber(r.sku.trim()) }))
    .filter((r) => r.sku && !have.has(r.skuNormalized) && have.add(r.skuNormalized));
  if (fresh.length) await db.insert(compatibleSkus).values(fresh.map((r) => ({ productId, ...r })));
  return fresh.length;
}

export async function removeCompatibleSku(productId: number, id: number): Promise<void> {
  await getDb().delete(compatibleSkus).where(and(eq(compatibleSkus.id, id), eq(compatibleSkus.productId, productId)));
}

/** Legacy "merge parts to parent": moves this child's cross-refs onto its parent. */
export async function mergeCompatibleSkusToParent(productId: number): Promise<number> {
  const db = getDb();
  const p = await db.query.products.findFirst({ columns: { parentProductId: true }, where: eq(products.id, productId) });
  if (!p?.parentProductId) throw new ProductError('This product has no parent.');
  const mine = await db.select().from(compatibleSkus).where(eq(compatibleSkus.productId, productId));
  const n = await addCompatibleSkus(p.parentProductId, mine.map((m) => ({ brand: m.brand, sku: m.sku })));
  await db.delete(compatibleSkus).where(eq(compatibleSkus.productId, productId));
  return n;
}

// ---------- compatible models ----------

export async function addModels(productId: number, rows: { manufacturer: string; modelNumber: string; category: string | null }[], relation = 'compatible'): Promise<{ added: number; created: number }> {
  const db = getDb();
  let added = 0;
  let created = 0;
  for (const r of rows) {
    const number = r.modelNumber.trim().toUpperCase();
    if (!number) continue;
    const norm = normalizeModelNumber(number);
    let model = await db.query.applianceModels.findFirst({ where: eq(applianceModels.normalized, norm) });
    if (!model) {
      const [ins] = await db.insert(applianceModels).values({ modelNumber: number, normalized: norm, brandName: r.manufacturer.trim() || null, applianceType: r.category?.trim() || null }).returning();
      model = ins!;
      created++;
    }
    const link = await db.select({ productId: modelProducts.productId }).from(modelProducts).where(and(eq(modelProducts.modelId, model.id), eq(modelProducts.productId, productId))).limit(1);
    if (!link[0]) {
      await db.insert(modelProducts).values({ modelId: model.id, productId, relation });
      added++;
    }
  }
  return { added, created };
}

/** Removes the model link from the product and, as the legacy did, from its child products. */
export async function removeModel(productId: number, modelId: number): Promise<void> {
  const db = getDb();
  const kids = await db.select({ id: products.id }).from(products).where(eq(products.parentProductId, productId));
  const ids = [productId, ...kids.map((k) => k.id)];
  await db.delete(modelProducts).where(and(eq(modelProducts.modelId, modelId), inArray(modelProducts.productId, ids)));
}

export async function mergeModelsToParent(productId: number): Promise<number> {
  const db = getDb();
  const p = await db.query.products.findFirst({ columns: { parentProductId: true }, where: eq(products.id, productId) });
  if (!p?.parentProductId) throw new ProductError('This product has no parent.');
  const mine = await db.select().from(modelProducts).where(eq(modelProducts.productId, productId));
  let n = 0;
  for (const m of mine) {
    const exists = await db.select({ p: modelProducts.productId }).from(modelProducts).where(and(eq(modelProducts.modelId, m.modelId), eq(modelProducts.productId, p.parentProductId))).limit(1);
    if (!exists[0]) {
      await db.insert(modelProducts).values({ modelId: m.modelId, productId: p.parentProductId, relation: m.relation, sortOrder: m.sortOrder });
      n++;
    }
  }
  await db.delete(modelProducts).where(eq(modelProducts.productId, productId));
  return n;
}

// ---------- SxS compare specs ----------

export const COMPARE_TYPES: Record<number, string> = {
  0: 'None (classic side-by-side)',
  1: 'Refrigerator Filters',
  2: 'Air Filters',
  3: 'Humidifier Filters',
  4: 'Air Purifier Filters',
  6: 'Sediment Water Filters',
  8: 'Ice Makers',
  9: 'Filtration Masks',
  11: 'Refrigerator Air Filters',
  12: 'Filtration Straws',
  13: 'Inline Filters',
  14: 'Carbon Water Filters',
  15: 'Pool & Spa',
};

/** Fields per compare type: [key, label, kind]. Shared with the storefront compare page. */
export const COMPARE_FIELDS: { key: string; label: string; kind: 'number' | 'text' | 'bool'; types: number[] | 'all' }[] = [
  { key: 'filterLifeMonths', label: 'Filter life (months)', kind: 'number', types: 'all' },
  { key: 'filterLifeMonthsTo', label: 'Filter life up to (months)', kind: 'number', types: 'all' },
  { key: 'merv', label: 'MERV rating', kind: 'number', types: [2, 4, 11] },
  { key: 'hideMerv', label: 'Hide capacity/MERV row', kind: 'bool', types: 'all' },
  { key: 'flowRate', label: 'Flow rate (GPM) / capacity (gallons)', kind: 'number', types: [1, 6, 12, 13, 14, 15] },
  { key: 'filterPercent', label: 'Filtration %', kind: 'number', types: [2, 4, 9] },
  { key: 'micron', label: 'Micron rating', kind: 'number', types: [1, 6, 12, 13, 14, 15] },
  { key: 'material', label: 'Material', kind: 'text', types: 'all' },
  { key: 'mediaType', label: 'Media type', kind: 'text', types: [2, 4, 15] },
  { key: 'connectionType', label: 'Fitting type', kind: 'text', types: [13, 14] },
  { key: 'efficiency', label: 'Efficiency', kind: 'text', types: [2, 4] },
  { key: 'iceCount', label: 'Ice per day', kind: 'text', types: [8] },
  { key: 'voltage', label: 'Voltage', kind: 'text', types: [8] },
  { key: 'diameter', label: 'Diameter', kind: 'text', types: [6, 13, 14, 15] },
  { key: 'top', label: 'Top style', kind: 'text', types: [15] },
  { key: 'bottomDiameter', label: 'Bottom diameter', kind: 'text', types: [15] },
  { key: 'length', label: 'Length', kind: 'text', types: [6, 13, 14, 15] },
  { key: 'weight', label: 'Weight', kind: 'text', types: [15] },
  { key: 'surfaceArea', label: 'Surface area (sq ft)', kind: 'text', types: [15] },
  { key: 'charcoalAir', label: 'Activated carbon', kind: 'bool', types: [2, 4, 11] },
  { key: 'nsf42', label: 'NSF 42 certified', kind: 'bool', types: [1, 6, 12, 13, 14] },
  { key: 'nsf53', label: 'NSF 53 certified', kind: 'bool', types: [1, 6, 12, 13, 14] },
  { key: 'lead', label: 'Reduces lead', kind: 'bool', types: [1, 12, 13, 14] },
  { key: 'mercury', label: 'Reduces mercury', kind: 'bool', types: [1, 12, 13, 14] },
  { key: 'chlorine', label: 'Reduces chlorine', kind: 'bool', types: [1, 6, 12, 13, 14] },
  { key: 'badtaste', label: 'Reduces bad taste', kind: 'bool', types: [1, 12, 13, 14] },
  { key: 'odor', label: 'Reduces odor', kind: 'bool', types: [1, 2, 3, 4, 11, 12, 13, 14] },
  { key: 'sediment', label: 'Reduces sediment', kind: 'bool', types: [1, 6, 13, 14] },
  { key: 'silt', label: 'Reduces silt', kind: 'bool', types: [6, 13, 14] },
  { key: 'scale', label: 'Reduces scale', kind: 'bool', types: [6, 13, 14] },
  { key: 'bacteria', label: 'Reduces bacteria / protozoa', kind: 'bool', types: [1, 9, 12, 13, 14] },
  { key: 'virusCarriers', label: 'Reduces virus carriers', kind: 'bool', types: [2, 4, 9] },
  { key: 'dust', label: 'Captures dust', kind: 'bool', types: [2, 4, 11] },
  { key: 'pollen', label: 'Captures pollen', kind: 'bool', types: [2, 4, 11] },
  { key: 'moldSpores', label: 'Captures mold spores', kind: 'bool', types: [2, 3, 4, 11] },
  { key: 'petDander', label: 'Captures pet dander', kind: 'bool', types: [2, 4, 11] },
  { key: 'smokeSmog', label: 'Captures smoke / smog', kind: 'bool', types: [2, 4, 11] },
  { key: 'allergens', label: 'Captures allergens', kind: 'bool', types: [2, 4, 9, 11] },
  { key: 'antimicrobial', label: 'Antimicrobial / prevents mold growth', kind: 'bool', types: [2, 3, 4, 15] },
  { key: 'alleviateCold', label: 'Alleviates cold symptoms', kind: 'bool', types: [3] },
  { key: 'wireHarness', label: 'Wire harness', kind: 'bool', types: [8] },
  { key: 'incDirections', label: 'Includes directions', kind: 'bool', types: [8] },
  { key: 'disposable', label: 'Disposable', kind: 'bool', types: [9, 12] },
  { key: 'n95', label: 'N95', kind: 'bool', types: [9] },
  { key: 'n99', label: 'N99', kind: 'bool', types: [9] },
  { key: 'bpaFree', label: 'BPA free', kind: 'bool', types: [12, 13, 14] },
];

export function compareFieldsFor(type: number) {
  return COMPARE_FIELDS.filter((f) => f.types === 'all' || f.types.includes(type));
}

export async function saveCompareSpecs(productId: number, compareType: number, data: Record<string, unknown>): Promise<void> {
  const db = getDb();
  if (!COMPARE_TYPES[compareType]) throw new ProductError('Unknown comparison type.');
  const p = await db.query.products.findFirst({ columns: { compareToId: true }, where: eq(products.id, productId) });
  if (compareType > 0 && p?.compareToId) {
    const other = await db.query.productCompareSpecs.findFirst({ where: eq(productCompareSpecs.productId, p.compareToId) });
    if (other && other.compareType > 0 && other.compareType !== compareType) throw new ProductError(`The compared product uses type "${COMPARE_TYPES[other.compareType]}"; both must match.`);
  }
  if (compareType === 0) {
    await db.delete(productCompareSpecs).where(eq(productCompareSpecs.productId, productId));
    return;
  }
  const clean: Record<string, unknown> = {};
  for (const f of compareFieldsFor(compareType)) {
    const v = data[f.key];
    if (f.kind === 'bool') clean[f.key] = v === true || v === 'true' || v === 'on' || v === '1';
    else if (f.kind === 'number') {
      const n = Number(v);
      if (v !== '' && v !== null && v !== undefined && Number.isFinite(n)) clean[f.key] = n;
    } else if (typeof v === 'string' && v.trim()) clean[f.key] = v.trim();
  }
  await db
    .insert(productCompareSpecs)
    .values({ productId, compareType, data: JSON.stringify(clean), updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({ target: productCompareSpecs.productId, set: { compareType, data: JSON.stringify(clean), updatedAt: new Date().toISOString() } });
}

// ---------- related products ----------

export async function setRelatedProducts(productId: number, relatedIds: number[], kind = 'related'): Promise<void> {
  const db = getDb();
  const ids = [...new Set(relatedIds.filter((n) => Number.isInteger(n) && n > 0 && n !== productId))].slice(0, 10);
  await db.delete(relatedProducts).where(and(eq(relatedProducts.productId, productId), eq(relatedProducts.kind, kind)));
  if (ids.length) {
    const valid = await db.select({ id: products.id }).from(products).where(inArray(products.id, ids));
    const order = new Map(ids.map((id, i) => [id, i]));
    if (valid.length) await db.insert(relatedProducts).values(valid.map((v) => ({ productId, relatedProductId: v.id, kind, sortOrder: order.get(v.id) ?? 0 })));
  }
}

// ---------- options ----------

/** One option group per product (legacy rule); null removes it. Applies to the parent for paired SKUs. */
export async function setProductOptionGroup(productId: number, groupId: number | null): Promise<void> {
  const db = getDb();
  await db.delete(productOptionGroups).where(eq(productOptionGroups.productId, productId));
  if (groupId) {
    const g = await db.query.optionGroups.findFirst({ where: eq(optionGroups.id, groupId) });
    if (!g) throw new ProductError('Option group not found.');
    await db.insert(productOptionGroups).values({ productId, groupId, sortOrder: 0 });
  }
}

export async function saveProductOption(productId: number, optionId: number, patch: { excluded?: boolean; stock?: number | null; priceOverrideCents?: number | null; sku?: string | null; imageUrl?: string | null }): Promise<void> {
  const db = getDb();
  const existing = await db.select().from(productOptions).where(and(eq(productOptions.productId, productId), eq(productOptions.optionId, optionId))).limit(1);
  const row = { ...(existing[0] ?? { productId, optionId, sku: null, stock: null, excluded: false, priceOverrideCents: null, imageUrl: null }), ...patch };
  if (existing[0]) await db.update(productOptions).set(row).where(and(eq(productOptions.productId, productId), eq(productOptions.optionId, optionId)));
  else await db.insert(productOptions).values(row);
}

// ---------- sale restrictions ----------

export async function setSaleRestrictions(productId: number, rows: { country: string; region: string | null }[]): Promise<void> {
  const db = getDb();
  await db.delete(saleRestrictions).where(eq(saleRestrictions.productId, productId));
  const clean = rows.map((r) => ({ productId, country: r.country.trim().toUpperCase(), region: r.region?.trim().toUpperCase() || null })).filter((r) => /^[A-Z]{2}$/.test(r.country));
  if (clean.length) await db.insert(saleRestrictions).values(clean);
}
