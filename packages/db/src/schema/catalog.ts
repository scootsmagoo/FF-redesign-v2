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
    featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
    hideFromListings: integer('hide_from_listings', { mode: 'boolean' }).notNull().default(false),
    /** legacy categoryType: Brands | Type | Sizes | Deal | MarketingPromos | Filtration Levels */
    categoryType: text('category_type'),
    graphicUrl: text('graphic_url'),
    logoUrl: text('logo_url'),
    contentLocation: integer('content_location'),
    shortHtml: text('short_html'), // legacy categoryHTML
  },
  (t) => [uniqueIndex('categories_slug_idx').on(t.slug), index('categories_parent_idx').on(t.parentId)],
);

export const products = sqliteTable(
  'products',
  {
    id: integer('id').primaryKey(), // legacy idProduct
    sku: text('sku').notNull(),
    manufacturerSku: text('manufacturer_sku'), // legacy manufacturesku (OEM part number)
    name: text('name').notNull(), // legacy description (title)
    slug: text('slug').notNull(),
    legacySlug: text('legacy_slug'), // legacy pagename incl. .asp
    brandId: integer('brand_id').references(() => brands.id),
    brandName: text('brand_name'), // denormalised legacy manufacture string
    descriptionHtml: text('description_html'), // legacy details
    shortDescription: text('short_description'), // legacy descriptionLong
    searchKeywords: text('search_keywords'), // legacy relatedKeys
    priceCents: integer('price_cents').notNull().default(0),
    listPriceCents: integer('list_price_cents'),
    asLowAsCents: integer('as_low_as_cents'),
    imageUrl: text('image_url'),
    thumbUrl: text('thumb_url'),
    stock: integer('stock').notNull().default(0), // legacy sentinels: -250 discontinued, -150 special
    ignoreStock: integer('ignore_stock', { mode: 'boolean' }).notNull().default(false),
    leadTimeDays: integer('lead_time_days'),
    dropShip: integer('drop_ship', { mode: 'boolean' }).notNull().default(false),
    /** legacy blockedReason: '' sellable, 'TEMPUNAVBL' temporarily unavailable, other = blocked (NLA, REMOVED, …) */
    blockedReason: text('blocked_reason'),
    hotDeal: integer('hot_deal', { mode: 'boolean' }).notNull().default(false),
    homePageRank: integer('home_page_rank').notNull().default(0), // legacy homePage list priority
    recommendedFrequencyMonths: integer('recommended_frequency_months'),
    recommendedProductId: integer('recommended_product_id'),
    /** 'oem' | 'compatible' | null (legacy familyDesignation) */
    familyDesignation: text('family_designation'),
    packSize: integer('pack_size'),
    maxCartQty: integer('max_cart_qty'),
    hidePrice: integer('hide_price', { mode: 'boolean' }).notNull().default(false), // legacy showPriceInCart (MAP)
    returnPolicyCode: integer('return_policy_code').notNull().default(0), // legacy retExclude 0/1/2
    upc: text('upc'),
    parentProductId: integer('parent_product_id'), // legacy idPaired
    compareDefaultOptionId: integer('compare_default_option_id'),
    discontinuedAlternativeId: integer('discontinued_alternative_id'),
    /** 'product' | 'category' (legacy discontinuedAltType) */
    discontinuedAlternativeKind: text('discontinued_alternative_kind'),
    discontinuedText: text('discontinued_text'),
    tempUnavailableAlternativeId: integer('temp_unavailable_alternative_id'),
    tempUnavailableText: text('temp_unavailable_text'),
    isFridgeFilter: integer('is_fridge_filter', { mode: 'boolean' }).notNull().default(false),
    isFfAirFilter: integer('is_ff_air_filter', { mode: 'boolean' }).notNull().default(false),
    isFfWaterFilter: integer('is_ff_water_filter', { mode: 'boolean' }).notNull().default(false),
    isHumidifierFilter: integer('is_humidifier_filter', { mode: 'boolean' }).notNull().default(false),
    isHomeAirFilter: integer('is_home_air_filter', { mode: 'boolean' }).notNull().default(false),
    guaranteeBadge: integer('guarantee_badge', { mode: 'boolean' }).notNull().default(false),
    searchable: integer('searchable', { mode: 'boolean' }).notNull().default(true), // inverse of legacy siteSearchDisable
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
    metaKeywords: text('meta_keywords'),
    // ---- manager-parity columns (legacy SA_prod_edit fields not in the first import) ----
    /** minimum advertised price; the editor refuses a price or feed price below it */
    mapCents: integer('map_cents'),
    /** cost of goods (legacy cgs) */
    costCents: integer('cost_cents'),
    /** dimensional fee per unit above 4 (appliance parts only) */
    dimFeeCents: integer('dim_fee_cents'),
    discountedShipping: integer('discounted_shipping', { mode: 'boolean' }).notNull().default(false),
    freeProduct: integer('free_product', { mode: 'boolean' }).notNull().default(false),
    giftWithPurchaseId: integer('gift_with_purchase_id'),
    /** Ordergroove feed price override (legacy ogPrice) */
    ogPriceCents: integer('og_price_cents'),
    /** 2 = the compared (compatible) item shows first on the SxS page, 1 = this item first */
    compareSortOrder: integer('compare_sort_order').notNull().default(1),
    includeInFeed: integer('include_in_feed', { mode: 'boolean' }).notNull().default(true),
    feedOverride: integer('feed_override', { mode: 'boolean' }).notNull().default(false),
    /** legacy Item_No_: NAV item number (read-only in the manager) */
    navItemNo: text('nav_item_no'),
    /** warehouse count (legacy actualInventory), fed by the WMS */
    actualInventory: integer('actual_inventory'),
    /** Google Shopping / Dealtime category */
    googleCategory: text('google_category'),
    /** comparison-engine feed text (legacy ProductSearchCompDetails.Details) */
    comparisonText: text('comparison_text'),
    /** legacy wpNotAff: show the "not affiliated" disclaimer */
    showUnaffiliated: integer('show_unaffiliated', { mode: 'boolean' }).notNull().default(false),
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
    /** swatch/variant image (legacy product_option_images) */
    imageUrl: text('image_url'),
  },
  (t) => [primaryKey({ columns: [t.productId, t.optionId] })],
);

/**
 * Where a product may not be sold (legacy sale_restrictions): a country code, optionally with a
 * state/province. Checked against the shipping address at checkout.
 */
export const saleRestrictions = sqliteTable(
  'sale_restrictions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    country: text('country').notNull(), // ISO-3166 alpha-2
    region: text('region'), // null = whole country
  },
  (t) => [index('sale_restrictions_product_idx').on(t.productId), index('sale_restrictions_country_idx').on(t.country, t.region)],
);

/** Per-channel / campaign prices (legacy tsourceprice): feeds and tracked links, not the storefront price. */
export const channelPrices = sqliteTable(
  'channel_prices',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    optionId: integer('option_id'),
    /** legacy tsource / campaign code */
    source: text('source').notNull(),
    priceCents: integer('price_cents').notNull(),
    adMedium: text('ad_medium'),
    priceDate: text('price_date'),
  },
  (t) => [index('channel_prices_product_idx').on(t.productId), index('channel_prices_source_idx').on(t.source)],
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
