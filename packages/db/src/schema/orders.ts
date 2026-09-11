import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { products } from './catalog';
import { customers } from './customers';

/**
 * Carts and orders are separate tables in v2 (legacy used one cartHead row for
 * both, keyed by orderStatus). A cart becomes an order at payment capture.
 */
export const carts = sqliteTable(
  'carts',
  {
    id: text('id').primaryKey(), // uuid, also stored in the session
    customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    currency: text('currency').notNull().default('USD'),
    promoCodes: text('promo_codes'), // JSON array of applied codes
    /** attribution: utm source/campaign, affiliate id */
    attribution: text('attribution'), // JSON
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
    updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [index('carts_customer_idx').on(t.customerId)],
);

export const cartItems = sqliteTable(
  'cart_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    cartId: text('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    optionId: integer('option_id'),
    qty: integer('qty').notNull().default(1),
    unitPriceCents: integer('unit_price_cents').notNull(),
    /** Home Filter Club frequency in months; null = one-time purchase */
    subscriptionMonths: integer('subscription_months'),
    /** custom-cut air filter SKU, when applicable */
    customSku: text('custom_sku'),
    customDescription: text('custom_description'),
    /** promotional reward line (gift with purchase) */
    isReward: integer('is_reward', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('cart_items_cart_idx').on(t.cartId)],
);

export const orders = sqliteTable(
  'orders',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    number: text('number').notNull(), // customer-facing order number
    legacyOrderId: integer('legacy_order_id'),
    customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    email: text('email').notNull(),
    /** pending | paid | processing | shipped | complete | cancelled | refunded */
    status: text('status').notNull().default('pending'),
    currency: text('currency').notNull().default('USD'),
    subtotalCents: integer('subtotal_cents').notNull(),
    discountCents: integer('discount_cents').notNull().default(0),
    shippingCents: integer('shipping_cents').notNull().default(0),
    taxCents: integer('tax_cents').notNull().default(0),
    donationCents: integer('donation_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull(),
    billingAddress: text('billing_address').notNull(), // JSON snapshot
    shippingAddress: text('shipping_address').notNull(), // JSON snapshot
    shippingMethod: text('shipping_method'),
    /** cybersource | paypal | applepay | googlepay */
    paymentProvider: text('payment_provider'),
    paymentRef: text('payment_ref'),
    promoCodes: text('promo_codes'),
    attribution: text('attribution'),
    /** free-text lookup key for guest order tracking (legacy randomKey) */
    accessKey: text('access_key').notNull(),
    placedAt: text('placed_at').notNull().default(sql`(current_timestamp)`),
    /** when the order was handed to NAV / fulfilment */
    exportedAt: text('exported_at'),
    // ---- manager-parity columns ----
    /** 1 buyer, 2 merchant, 3 duplicate/invalid, 4 fraud (legacy ReasonCancelled) */
    cancelReason: integer('cancel_reason'),
    cancelledAt: text('cancelled_at'),
    /** staff-only notes, newest first (legacy storeCommentsPriv) */
    privateNotes: text('private_notes'),
    /** status history shown to the customer (legacy storeComments) */
    publicNotes: text('public_notes'),
    salesCode: text('sales_code'),
    ipAddress: text('ip_address'),
  },
  (t) => [
    uniqueIndex('orders_number_idx').on(t.number),
    index('orders_customer_idx').on(t.customerId),
    index('orders_email_idx').on(t.email),
    index('orders_placed_idx').on(t.placedAt),
  ],
);

export const orderItems = sqliteTable(
  'order_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: integer('product_id'),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    optionLabel: text('option_label'),
    qty: integer('qty').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    discountCents: integer('discount_cents').notNull().default(0),
    subscriptionMonths: integer('subscription_months'),
    customSku: text('custom_sku'),
    returnable: integer('returnable', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
);

export const shipments = sqliteTable(
  'shipments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    carrier: text('carrier'),
    trackingNumber: text('tracking_number'),
    shippedAt: text('shipped_at'),
  },
  (t) => [index('shipments_order_idx').on(t.orderId)],
);

/**
 * Audit + idempotency log for calls made into the site by other systems
 * (Ordergroove order insertion, WMS ship confirmations, marketplace webhooks).
 * One row per received call; `(source, external_id)` is unique so a retried
 * delivery returns the original result instead of creating a second order.
 */
export const inboundEvents = sqliteTable(
  'inbound_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** ordergroove | wms | shopify | walmart */
    source: text('source').notNull(),
    /** caller's own id for the call (Ordergroove order id, tracking number, webhook id) */
    externalId: text('external_id').notNull(),
    /** received | ok | error | duplicate */
    status: text('status').notNull().default('received'),
    orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
    error: text('error'),
    /** raw request body as received (XML / JSON / form), for replay and support */
    payload: text('payload'),
    remoteIp: text('remote_ip'),
    receivedAt: text('received_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [uniqueIndex('inbound_events_source_ext_idx').on(t.source, t.externalId), index('inbound_events_received_idx').on(t.receivedAt)],
);
