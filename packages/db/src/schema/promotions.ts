import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Order-level promotions (legacy DiscOrder). Columns the engine reads are first-class;
 * everything else from the legacy row is kept in `legacyJson` so no rule is lost while
 * the promotion engine is ported (inventory 01 §6).
 */
export const promotions = sqliteTable(
  'promotions',
  {
    id: integer('id').primaryKey(), // legacy idDiscOrder
    code: text('code'), // legacy discCode (public code; null for tag-only campaigns)
    tag: text('tag'), // legacy discTag (campaign id shared by single-use codes)
    title: text('title'),
    status: text('status').notNull().default('inactive'), // active | inactive
    percentOff: real('percent_off'),
    amountOffCents: integer('amount_off_cents'),
    minSubtotalCents: integer('min_subtotal_cents'),
    maxSubtotalCents: integer('max_subtotal_cents'),
    validFrom: text('valid_from'), // ISO date
    validTo: text('valid_to'),
    onceOnly: integer('once_only', { mode: 'boolean' }).notNull().default(false),
    freeShipping: integer('free_shipping', { mode: 'boolean' }).notNull().default(false),
    exclusive: integer('exclusive', { mode: 'boolean' }).notNull().default(false),
    compoundable: integer('compoundable', { mode: 'boolean' }).notNull().default(false),
    allowOnForms: integer('allow_on_forms', { mode: 'boolean' }).notNull().default(true),
    /** 0 global, 1 product-driven, 2 category-driven (legacy promoItemFlag) */
    scopeKind: integer('scope_kind').notNull().default(0),
    /** legacy promoItemDisc: id or negative class sentinel (-9..-4), see inventory 01 §6 */
    scopeRef: integer('scope_ref'),
    matchValue: text('match_value'),
    giftWithPurchase: integer('gift_with_purchase', { mode: 'boolean' }).notNull().default(false),
    bogo: integer('bogo', { mode: 'boolean' }).notNull().default(false),
    tiered: integer('tiered', { mode: 'boolean' }).notNull().default(false),
    legacyJson: text('legacy_json').notNull(), // full legacy row
    // ---- manager-parity columns (legacy SA_prod_discounts editor) ----
    singleUse: integer('single_use', { mode: 'boolean' }).notNull().default(false),
    multiplyByQty: integer('multiply_by_qty', { mode: 'boolean' }).notNull().default(false),
    usableEveryDays: integer('usable_every_days'),
    /** 0 homepage, 1 landing page, 2 product page, 3 category page */
    landingKind: integer('landing_kind').notNull().default(0),
    contentHtml: text('content_html'),
    imageUrl: text('image_url'),
    productText: text('product_text'),
    notes: text('notes'),
    /** only Site Administrators may change a locked promotion */
    locked: integer('locked', { mode: 'boolean' }).notNull().default(false),
    createdBy: text('created_by'),
    updatedAt: text('updated_at'),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [index('promotions_code_idx').on(t.code), index('promotions_tag_idx').on(t.tag), index('promotions_status_idx').on(t.status)],
);

/** Single-use codes tied to a promotion tag (legacy tDiscCode / tReorderCode). */
export const promoCodes = sqliteTable(
  'promo_codes',
  {
    code: text('code').primaryKey(),
    tag: text('tag').notNull(),
    status: text('status').notNull().default('active'), // active | used | inactive
    usedOrderId: integer('used_order_id'),
    usedAt: text('used_at'),
  },
  (t) => [index('promo_codes_tag_idx').on(t.tag)],
);

export const shipMethods = sqliteTable('ship_methods', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});

export const shipRates = sqliteTable(
  'ship_rates',
  {
    id: integer('id').primaryKey(),
    methodId: integer('method_id').notNull(),
    zone: integer('zone').notNull(),
    unitType: text('unit_type').notNull(), // legacy unitType: W weight / P price
    unitsFrom: real('units_from').notNull(),
    unitsTo: real('units_to').notNull(),
    addAmountCents: integer('add_amount_cents').notNull().default(0),
    addPercent: real('add_percent').notNull().default(0),
  },
  (t) => [index('ship_rates_method_idx').on(t.methodId, t.zone)],
);

/** Countries and states with tax rate and ship zone (legacy Locations). */
export const locations = sqliteTable(
  'locations',
  {
    id: integer('id').primaryKey(),
    name: text('name').notNull(),
    country: text('country').notNull(),
    region: text('region'), // null on country rows
    taxRate: real('tax_rate').notNull().default(0),
    shipZone: integer('ship_zone'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [uniqueIndex('locations_country_region_idx').on(t.country, t.region)],
);
