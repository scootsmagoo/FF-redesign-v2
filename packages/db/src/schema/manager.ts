import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { admins } from './admins';
import { products } from './catalog';
import { orders } from './orders';

/**
 * Tables added for the manager (back-office) parity build, September 2026. Each mirrors a legacy
 * Manager table (named in the comments) but with v2 conventions: integer cents, ISO timestamps,
 * hashes instead of reversible ciphers, no raw SQL.
 */

// ---------- staff: roles, audit ----------

/**
 * Roles (legacy cp_roles + cp_role_permissions). `permissions` is JSON {"Products":1,"Orders":0,...}
 * using the legacy area names and levels: -1 none, 0 read-only, 1 full control, 2 restricted.
 * An admin's effective level = own `admins.permissions` override for the area, else the role's,
 * else -1. Admins with no role and no overrides are treated as Site Administrators (full access)
 * so the bootstrap account can never lock itself out.
 */
export const adminRoles = sqliteTable(
  'admin_roles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    permissions: text('permissions').notNull().default('{}'),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [uniqueIndex('admin_roles_name_idx').on(t.name)],
);

/** Legacy cp_failed_logins. */
export const adminFailedLogins = sqliteTable(
  'admin_failed_logins',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull(),
    method: text('method').notNull().default('form'),
    ipAddress: text('ip_address'),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [index('admin_failed_logins_created_idx').on(t.createdAt)],
);

/** Legacy cp_pwd_history: recent hashes, so a rotated password cannot be reused. */
export const adminPasswordHistory = sqliteTable(
  'admin_password_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    adminId: integer('admin_id')
      .notNull()
      .references(() => admins.id, { onDelete: 'cascade' }),
    passwordHash: text('password_hash').notNull(),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [index('admin_password_history_admin_idx').on(t.adminId)],
);

/** Legacy custom_sales_code: sales-person codes stamped on orders taken by staff. */
export const salesCodes = sqliteTable(
  'sales_codes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [uniqueIndex('sales_codes_code_idx').on(t.code)],
);

// ---------- products ----------

/** Legacy product_price_changelog: who changed a price or its quantity tiers, and when. */
export const productPriceChangelog = sqliteTable(
  'product_price_changelog',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id').notNull(),
    prevPriceCents: integer('prev_price_cents'),
    newPriceCents: integer('new_price_cents'),
    /** "before*after" tier strings when the tiers changed */
    tierChanges: text('tier_changes'),
    adminEmail: text('admin_email'),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [index('product_price_changelog_product_idx').on(t.productId)],
);

/**
 * Side-by-side comparison attributes (legacy productSpecs): one row per product, typed by
 * `compareType` (1 refrigerator, 2 air, 3 humidifier, 4 air purifier, 6 sediment water, 8 ice
 * makers, 9 masks, 11 fridge air, 12 straws, 13 inline, 14 carbon water, 15 pool and spa).
 * `data` is JSON keyed by the legacy column names (merv, micron, nsf42, ...) so the SxS page can
 * render whichever rows the type defines.
 */
export const productCompareSpecs = sqliteTable('product_compare_specs', {
  productId: integer('product_id')
    .primaryKey()
    .references(() => products.id, { onDelete: 'cascade' }),
  compareType: integer('compare_type').notNull().default(0),
  data: text('data').notNull().default('{}'),
  updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
});

// ---------- marketing ----------

/** Newsletters composed in the manager (legacy newsletters); sending goes through the email provider in batches. */
export const newsletters = sqliteTable('newsletters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subject: text('subject').notNull(),
  bodyHtml: text('body_html').notNull(),
  /** all | optin | optout */
  segment: text('segment').notNull().default('optin'),
  paidOnly: integer('paid_only', { mode: 'boolean' }).notNull().default(false),
  recipientCount: integer('recipient_count'),
  sentCount: integer('sent_count').notNull().default(0),
  /** last address sent, so an interrupted send can resume (legacy newsBookmark) */
  bookmark: text('bookmark'),
  sentAt: text('sent_at'),
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
});

/** Affiliate landing pages (legacy affiliateRecords): /aff/{slug} with a discount and a curated product/category set. */
export const affiliates = sqliteTable(
  'affiliates',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    contentHtml: text('content_html'),
    imageUrl: text('image_url'),
    discountPercent: real('discount_percent').notNull().default(0),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [uniqueIndex('affiliates_slug_idx').on(t.slug)],
);

export const affiliateItems = sqliteTable(
  'affiliate_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    affiliateId: integer('affiliate_id')
      .notNull()
      .references(() => affiliates.id, { onDelete: 'cascade' }),
    /** product | category */
    kind: text('kind').notNull(),
    itemId: integer('item_id').notNull(),
  },
  (t) => [index('affiliate_items_affiliate_idx').on(t.affiliateId)],
);

// ---------- customers ----------

/** Audit of account merges (legacy merged_orders_tracking): which orders moved to which customer. */
export const customerMerges = sqliteTable(
  'customer_merges',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    toCustomerId: integer('to_customer_id').notNull(),
    fromCustomerId: integer('from_customer_id'),
    orderId: integer('order_id').notNull(),
    adminEmail: text('admin_email'),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [index('customer_merges_to_idx').on(t.toCustomerId)],
);

/** Back-in-stock requests from the PDP (legacy backorder_notification). */
export const backorderRequests = sqliteTable(
  'backorder_requests',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id').notNull(),
    optionId: integer('option_id'),
    email: text('email').notNull(),
    customerId: integer('customer_id'),
    notifiedAt: text('notified_at'),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [index('backorder_requests_product_idx').on(t.productId), index('backorder_requests_open_idx').on(t.notifiedAt)],
);

// ---------- orders ----------

/** Credits / refunds issued against an order (legacy order_credits). Money moves through the payment provider. */
export const orderCredits = sqliteTable(
  'order_credits',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    customerId: integer('customer_id'),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default('USD'),
    /** original | paypal | manual */
    method: text('method').notNull().default('original'),
    /** legacy reason code (DAMAGED, RESTOCK, WEB ERROR, ...) */
    reason: text('reason').notNull(),
    note: text('note'),
    /** success | pending | failed */
    status: text('status').notNull().default('success'),
    providerRef: text('provider_ref'),
    response: text('response'),
    adminEmail: text('admin_email'),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [index('order_credits_order_idx').on(t.orderId), index('order_credits_customer_idx').on(t.customerId)],
);

/** Returns / RMAs (legacy returnheader). status: requested | label | approved | refunded | cancelled. */
export const returns = sqliteTable(
  'returns',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    customerId: integer('customer_id'),
    status: text('status').notNull().default('requested'),
    totalCents: integer('total_cents').notNull().default(0),
    feeCents: integer('fee_cents').notNull().default(0),
    taxCents: integer('tax_cents').notNull().default(0),
    discountCents: integer('discount_cents').notNull().default(0),
    comment: text('comment'),
    labelTracking: text('label_tracking'),
    refundedAt: text('refunded_at'),
    adminEmail: text('admin_email'),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [index('returns_order_idx').on(t.orderId), index('returns_status_idx').on(t.status)],
);

export const returnItems = sqliteTable(
  'return_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    returnId: integer('return_id')
      .notNull()
      .references(() => returns.id, { onDelete: 'cascade' }),
    productId: integer('product_id'),
    sku: text('sku').notNull(),
    optionLabel: text('option_label'),
    qty: integer('qty').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    reason: text('reason'),
    refundOnly: integer('refund_only', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('return_items_return_idx').on(t.returnId)],
);

// ---------- payments ----------

/**
 * Gateway call log (legacy payment_processing_logs): one row per authorize/capture or refund
 * attempt, success or not, so staff can see what the provider answered without the raw order.
 * Never stores card data; `message` is the provider's decline reason or reference text.
 */
export const paymentLogs = sqliteTable(
  'payment_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderNumber: text('order_number'),
    customerId: integer('customer_id'),
    email: text('email'),
    /** authorize_capture | refund */
    kind: text('kind').notNull(),
    provider: text('provider').notNull(),
    method: text('method'),
    amountCents: integer('amount_cents').notNull().default(0),
    currency: text('currency').notNull().default('USD'),
    ok: integer('ok', { mode: 'boolean' }).notNull(),
    transactionId: text('transaction_id'),
    message: text('message'),
    ipAddress: text('ip_address'),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [index('payment_logs_created_idx').on(t.createdAt), index('payment_logs_order_idx').on(t.orderNumber), index('payment_logs_customer_idx').on(t.customerId)],
);
