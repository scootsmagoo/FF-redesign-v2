import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Catalog schema. IDs are the legacy SQL Server identity values so imports are
 * idempotent and legacy cross-references (compatibility, orders) keep working.
 * Money is integer cents.
 */

export const brands = sqliteTable(
  'brands',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    logoUrl: text('logo_url'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [uniqueIndex('brands_slug_idx').on(t.slug), uniqueIndex('brands_name_idx').on(t.name)],
);

export const categories = sqliteTable(
  'categories',
  {
    id: integer('id').primaryKey(), // legacy idCategory
    parentId: integer('parent_id'),
    name: text('name').notNull(), // legacy categoryDesc
    h1: text('h1'), // legacy categoryH1
    slug: text('slug').notNull(), // v2 slug
    legacySlug: text('legacy_slug'), // legacy pagname incl. .asp
    descriptionHtml: text('description_html'), // legacy categoryHTMLLong
    imageUrl: text('image_url'),
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    /** legacy cattype: 1 fridge brand, 2 hub, 3 ..., 4 ... (see inventory); null = plain */
    kind: integer('kind'),
    sortOrder: integer('sort_order').notNull().default(0),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    compareActive: integer('compare_active', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [uniqueIndex('categories_slug_idx').on(t.slug), index('categories_parent_idx').on(t.parentId)],
);

export const products = sqliteTable(
  'products',
  {
    id: integer('id').primaryKey(), // legacy idProduct
    sku: text('sku').notNull(),
    name: text('name').notNull(), // legacy description (title)
    slug: text('slug').notNull(),
    legacySlug: text('legacy_slug'), // legacy pagename incl. .asp
    brandId: integer('brand_id').references(() => brands.id),
    brandName: text('brand_name'), // denormalised legacy manufacture string
    descriptionHtml: text('description_html'), // legacy details
    shortDescription: text('short_description'),
    priceCents: integer('price_cents').notNull().default(0),
    listPriceCents: integer('list_price_cents'),
    asLowAsCents: integer('as_low_as_cents'),
    imageUrl: text('image_url'),
    thumbUrl: text('thumb_url'),
    stock: integer('stock').notNull().default(0), // legacy sentinels: -250 discontinued, -150 special
    ignoreStock: integer('ignore_stock', { mode: 'boolean' }).notNull().default(false),
    leadTimeDays: integer('lead_time_days'),
    freeShipping: integer('free_shipping', { mode: 'boolean' }).notNull().default(false),
    privateLabel: integer('private_label', { mode: 'boolean' }).notNull().default(false),
    packQty: integer('pack_qty').notNull().default(1),
    packUom: text('pack_uom'),
    autoshipEnabled: integer('autoship_enabled', { mode: 'boolean' }).notNull().default(false),
    compareToId: integer('compare_to_id'),
    compareToAltId: integer('compare_to_alt_id'),
    replacementForId: integer('replacement_for_id'),
    popRank: integer('pop_rank').notNull().default(9999),
    weightOz: real('weight_oz'),
    prop65: integer('prop65', { mode: 'boolean' }).notNull().default(false),
    madeInUsa: integer('made_in_usa', { mode: 'boolean' }).notNull().default(false),
    taxExempt: integer('tax_exempt', { mode: 'boolean' }).notNull().default(false),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
    updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [
    uniqueIndex('products_slug_idx').on(t.slug),
    index('products_sku_idx').on(t.sku),
    index('products_brand_idx').on(t.brandId),
    index('products_pop_idx').on(t.popRank),
  ],
);

export const categoryProducts = sqliteTable(
  'category_products',
  {
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.productId] }), index('category_products_product_idx').on(t.productId)],
);

export const productImages = sqliteTable(
  'product_images',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    alt: text('alt'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('product_images_product_idx').on(t.productId)],
);

export const optionGroups = sqliteTable('option_groups', {
  id: integer('id').primaryKey(), // legacy idOptionGroup
  name: text('name').notNull(), // legacy optionGroupDesc
  /** legacy optionType: select vs radio */
  displayType: text('display_type').notNull().default('select'),
  required: integer('required', { mode: 'boolean' }).notNull().default(true),
  sizingLink: text('sizing_link'),
});

export const options = sqliteTable(
  'options',
  {
    id: integer('id').primaryKey(), // legacy idOption
    groupId: integer('group_id')
      .notNull()
      .references(() => optionGroups.id, { onDelete: 'cascade' }),
    label: text('label').notNull(), // legacy optionDescrip
    priceAddCents: integer('price_add_cents').notNull().default(0),
    percentAdd: real('percent_add').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('options_group_idx').on(t.groupId)],
);

export const productOptionGroups = sqliteTable(
  'product_option_groups',
  {
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    groupId: integer('group_id')
      .notNull()
      .references(() => optionGroups.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.groupId] })],
);

/** Per product+option inventory/exclusion (legacy productOptionInventory + optionsProdEx). */
export const productOptions = sqliteTable(
  'product_options',
  {
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    optionId: integer('option_id')
      .notNull()
      .references(() => options.id, { onDelete: 'cascade' }),
    sku: text('sku'),
    stock: integer('stock'),
    excluded: integer('excluded', { mode: 'boolean' }).notNull().default(false),
    priceOverrideCents: integer('price_override_cents'),
  },
  (t) => [primaryKey({ columns: [t.productId, t.optionId] })],
);

export const productSpecs = sqliteTable(
  'product_specs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    value: text('value').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('product_specs_product_idx').on(t.productId)],
);

export const relatedProducts = sqliteTable(
  'related_products',
  {
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    relatedProductId: integer('related_product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    /** related | also-bought | compare | accessory */
    kind: text('kind').notNull().default('related'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.relatedProductId, t.kind] })],
);

/** Cross-reference part numbers (legacy productCompSKUList): "this product replaces Brand X part Y". */
export const compatibleSkus = sqliteTable(
  'compatible_skus',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    brand: text('brand').notNull(),
    sku: text('sku').notNull(),
    skuNormalized: text('sku_normalized').notNull(),
  },
  (t) => [index('compatible_skus_product_idx').on(t.productId), index('compatible_skus_norm_idx').on(t.skuNormalized)],
);

/** Quantity-tier discounts (legacy DiscProd). */
export const quantityTiers = sqliteTable(
  'quantity_tiers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    fromQty: integer('from_qty').notNull(),
    toQty: integer('to_qty'),
    discountCents: integer('discount_cents').notNull().default(0),
    discountPercent: real('discount_percent').notNull().default(0),
    /** legacy `source` channel restriction, null = all */
    source: text('source'),
  },
  (t) => [index('quantity_tiers_product_idx').on(t.productId)],
);
