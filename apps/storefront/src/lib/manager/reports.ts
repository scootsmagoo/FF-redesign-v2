import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { orderItems, orders, paymentLogs, products } from '@ff/db';
import { getDb } from '../db';

/**
 * Manager reports (legacy SA_stats, SA_totalsales, SA_totalsubscription, sa_daily_sales,
 * top300, sa_donation_dashboard, sa_marketplaces, SA_stats_google, SA_pay_processing,
 * sa_purchaser_export). Everything is computed from `orders` / `order_items`; nothing is
 * cached because D1 answers these in well under a second at our volumes.
 */

/** Orders that count as sales (legacy 1 paid, 2 shipped, 7 complete). */
export const PAID_STATUSES = ['paid', 'processing', 'shipped', 'complete'] as const;

export const STATUS_CHOICES: { value: string; label: string; statuses: string[] | null }[] = [
  { value: 'paid', label: 'Paid + shipped + complete', statuses: [...PAID_STATUSES] },
  { value: 'pending', label: 'Pending (unpaid)', statuses: ['pending'] },
  { value: 'processing', label: 'Processing', statuses: ['processing'] },
  { value: 'shipped', label: 'Shipped', statuses: ['shipped'] },
  { value: 'complete', label: 'Complete', statuses: ['complete'] },
  { value: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
  { value: 'refunded', label: 'Refunded', statuses: ['refunded'] },
  { value: 'all', label: 'All statuses', statuses: null },
];

export const INTERVALS = ['day', 'week', 'month', 'quarter', 'year'] as const;
export type Interval = (typeof INTERVALS)[number];
export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 21, 30];

/** Order sources, derived from `orders.attribution` (ordergroove/hfc:…, amazon:…, walmart:…, ebay:…). */
export const SOURCES = ['filtersfast', 'ordergroove', 'amazon', 'walmart', 'ebay'] as const;
export type Source = (typeof SOURCES)[number];
export const MARKETPLACES: Source[] = ['amazon', 'walmart', 'ebay'];

const sourceExpr = sql<string>`case
  when lower(coalesce(${orders.attribution}, '')) like 'ordergroove%' then 'ordergroove'
  when lower(coalesce(${orders.attribution}, '')) like 'amazon%' then 'amazon'
  when lower(coalesce(${orders.attribution}, '')) like 'walmart%' then 'walmart'
  when lower(coalesce(${orders.attribution}, '')) like 'ebay%' then 'ebay'
  else 'filtersfast' end`;

const sourceCond = (s: Source) => sql`${sourceExpr} = ${s}`;

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

function bucketExpr(interval: Interval) {
  switch (interval) {
    case 'day':
      return sql<string>`substr(${orders.placedAt}, 1, 10)`;
    case 'week':
      return sql<string>`strftime('%Y-W%W', ${orders.placedAt})`;
    case 'month':
      return sql<string>`substr(${orders.placedAt}, 1, 7)`;
    case 'quarter':
      return sql<string>`strftime('%Y', ${orders.placedAt}) || '-Q' || ((cast(strftime('%m', ${orders.placedAt}) as integer) + 2) / 3)`;
    case 'year':
      return sql<string>`strftime('%Y', ${orders.placedAt})`;
  }
}

const intervalDays: Record<Interval, number> = { day: 1, week: 7, month: 31, quarter: 92, year: 366 };

/** Orders over time (legacy SA_stats chart): count and total per bucket for the last `period` intervals. */
export async function ordersOverTime(opts: { status: string; period: number; interval: Interval }) {
  const choice = STATUS_CHOICES.find((c) => c.value === opts.status) ?? STATUS_CHOICES[0]!;
  const since = daysAgo(Math.min(30, Math.max(1, opts.period)) * intervalDays[opts.interval]);
  const bucket = bucketExpr(opts.interval);
  const rows = await getDb()
    .select({ bucket, count: sql<number>`count(*)`, totalCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)` })
    .from(orders)
    .where(and(gte(orders.placedAt, since), choice.statuses ? inArray(orders.status, choice.statuses) : undefined))
    .groupBy(bucket)
    .orderBy(bucket);
  return { rows, since, choice };
}

export async function topProducts(by: 'qty' | 'amount', days: number, limit = 50) {
  const measure = by === 'qty' ? sql<number>`sum(${orderItems.qty})` : sql<number>`sum((${orderItems.unitPriceCents} - ${orderItems.discountCents}) * ${orderItems.qty})`;
  return getDb()
    .select({ productId: orderItems.productId, sku: orderItems.sku, name: sql<string>`max(${orderItems.name})`, qty: sql<number>`sum(${orderItems.qty})`, amountCents: sql<number>`sum((${orderItems.unitPriceCents} - ${orderItems.discountCents}) * ${orderItems.qty})`, orders: sql<number>`count(distinct ${orderItems.orderId})` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(gte(orders.placedAt, daysAgo(days)), inArray(orders.status, [...PAID_STATUSES])))
    .groupBy(orderItems.sku)
    .orderBy(desc(measure))
    .limit(limit);
}

export async function topCustomers(by: 'orders' | 'value', days: number, limit = 50) {
  const measure = by === 'orders' ? sql<number>`count(*)` : sql<number>`sum(${orders.totalCents})`;
  return getDb()
    .select({ customerId: orders.customerId, email: orders.email, name: sql<string>`max(json_extract(${orders.billingAddress}, '$.firstName') || ' ' || json_extract(${orders.billingAddress}, '$.lastName'))`, orders: sql<number>`count(*)`, totalCents: sql<number>`sum(${orders.totalCents})` })
    .from(orders)
    .where(and(gte(orders.placedAt, daysAgo(days)), inArray(orders.status, [...PAID_STATUSES])))
    .groupBy(orders.email)
    .orderBy(desc(measure))
    .limit(limit);
}

export async function topCountries(days: number, limit = 50) {
  const country = sql<string>`coalesce(json_extract(${orders.shippingAddress}, '$.country'), '?')`;
  return getDb()
    .select({ country, orders: sql<number>`count(*)`, totalCents: sql<number>`sum(${orders.totalCents})` })
    .from(orders)
    .where(and(gte(orders.placedAt, daysAgo(days)), inArray(orders.status, [...PAID_STATUSES])))
    .groupBy(country)
    .orderBy(desc(sql`sum(${orders.totalCents})`))
    .limit(limit);
}

/** Active, stock-tracked products with the least on hand (legacy "lowest inventory" top 50). */
export async function lowestInventory(limit = 50) {
  return getDb()
    .select({ id: products.id, sku: products.sku, name: products.name, stock: products.stock, actualInventory: products.actualInventory, popRank: products.popRank })
    .from(products)
    .where(and(eq(products.active, true), eq(products.ignoreStock, false), eq(products.dropShip, false), gte(products.stock, 0)))
    .orderBy(asc(products.stock), asc(products.popRank))
    .limit(limit);
}

/** Per-day counts for one source over the last N days (legacy 14-day subscription / marketplace grids). */
export async function dailyBySource(source: Source, days = 14) {
  const day = sql<string>`substr(${orders.placedAt}, 1, 10)`;
  const rows = await getDb()
    .select({ day, count: sql<number>`count(*)`, revenueCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)`, discountCents: sql<number>`coalesce(sum(${orders.discountCents}), 0)` })
    .from(orders)
    .where(and(gte(orders.placedAt, daysAgo(days)), sourceCond(source), inArray(orders.status, [...PAID_STATUSES, 'pending'])))
    .groupBy(day)
    .orderBy(desc(day));
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: days }, (_, i) => {
    const d = daysAgo(i);
    const r = byDay.get(d);
    return { day: d, count: r?.count ?? 0, revenueCents: r?.revenueCents ?? 0, discountCents: r?.discountCents ?? 0, aovCents: r && r.count ? Math.round(r.revenueCents / r.count) : 0 };
  });
}

/** Net-of-tax sales and order count per month (legacy SA_totalsales / SA_totalsubscription). */
export async function totalSalesByMonth(opts: { subscriptionOnly: boolean; years?: number }) {
  const month = sql<string>`substr(${orders.placedAt}, 1, 7)`;
  const rows = await getDb()
    .select({ month, orders: sql<number>`count(*)`, grossCents: sql<number>`sum(${orders.totalCents})`, netCents: sql<number>`sum(${orders.totalCents} - ${orders.taxCents})`, taxCents: sql<number>`sum(${orders.taxCents})`, shippingCents: sql<number>`sum(${orders.shippingCents})`, discountCents: sql<number>`sum(${orders.discountCents})` })
    .from(orders)
    .where(and(gte(orders.placedAt, daysAgo(366 * (opts.years ?? 3))), inArray(orders.status, [...PAID_STATUSES, 'refunded']), opts.subscriptionOnly ? sourceCond('ordergroove') : undefined))
    .groupBy(month)
    .orderBy(desc(month));
  return rows;
}

export const DAILY_COLUMNS = [
  ['number', 'Order'], ['customer', 'Customer'], ['placedAt', 'Timestamp'], ['source', 'Source'], ['promoCodes', 'Promotion'], ['currency', 'Currency'], ['payment', 'Payment'], ['salesCode', 'Salesperson'],
  ['subtotal', 'Subtotal'], ['shipping', 'Shipping'], ['tax', 'Taxes'], ['donation', 'Donation'], ['discount', 'Discount'], ['total', 'Total'], ['valid', 'Valid'], ['status', 'Status'], ['reorder', 'Reorder'], ['subscription', 'Subscription'],
] as const;
export type DailyColumn = (typeof DAILY_COLUMNS)[number][0];
export const DAILY_TYPES = ['filtersfast', 'marketplace', 'ordergroove'] as const;
export type DailyType = (typeof DAILY_TYPES)[number];

/** Every order placed on a day for one report type, with the legacy "valid" arithmetic check and totals. */
export async function dailySales(date: string, type: DailyType) {
  const db = getDb();
  const cond = type === 'ordergroove' ? sourceCond('ordergroove') : type === 'marketplace' ? sql`${sourceExpr} in ('amazon', 'walmart', 'ebay')` : sourceCond('filtersfast');
  const rows = await db
    .select({
      id: orders.id, number: orders.number, customerId: orders.customerId, email: orders.email, placedAt: orders.placedAt, status: orders.status, currency: orders.currency, promoCodes: orders.promoCodes, paymentProvider: orders.paymentProvider, salesCode: orders.salesCode,
      subtotalCents: orders.subtotalCents, shippingCents: orders.shippingCents, taxCents: orders.taxCents, donationCents: orders.donationCents, discountCents: orders.discountCents, totalCents: orders.totalCents, source: sourceExpr,
      name: sql<string>`coalesce(json_extract(${orders.billingAddress}, '$.firstName'), '') || ' ' || coalesce(json_extract(${orders.billingAddress}, '$.lastName'), '')`,
      priorOrders: sql<number>`(select count(*) from orders o2 where o2.email = ${orders.email} and o2.placed_at < ${orders.placedAt} and o2.status in ('paid','processing','shipped','complete'))`,
      subscription: sql<number>`exists (select 1 from order_items i where i.order_id = ${orders.id} and i.subscription_months is not null)`,
    })
    .from(orders)
    .where(and(gte(orders.placedAt, date), lt(orders.placedAt, sql`date(${date}, '+1 day')`), cond))
    .orderBy(asc(orders.placedAt))
    .limit(2000);
  const withValid = rows.map((r) => ({ ...r, valid: r.subtotalCents + r.taxCents + r.shippingCents + r.donationCents - r.discountCents === r.totalCents }));
  const sum = (k: 'subtotalCents' | 'shippingCents' | 'taxCents' | 'donationCents' | 'discountCents' | 'totalCents') => withValid.reduce((a, r) => a + r[k], 0);
  return { rows: withValid, totals: { orders: withValid.length, subtotalCents: sum('subtotalCents'), shippingCents: sum('shippingCents'), taxCents: sum('taxCents'), donationCents: sum('donationCents'), discountCents: sum('discountCents'), totalCents: sum('totalCents'), invalid: withValid.filter((r) => !r.valid).length } };
}

/** Top SKUs / options sold in the last 7 days with current stock (legacy top300 shows 350). */
export async function topSellers(days = 7, limit = 350) {
  return getDb()
    .select({ productId: orderItems.productId, sku: orderItems.sku, optionLabel: orderItems.optionLabel, name: sql<string>`max(${orderItems.name})`, qty: sql<number>`sum(${orderItems.qty})`, orders: sql<number>`count(distinct ${orderItems.orderId})`, stock: products.stock, ignoreStock: products.ignoreStock, active: products.active, slug: products.slug })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(and(gte(orders.placedAt, daysAgo(days)), inArray(orders.status, [...PAID_STATUSES])))
    .groupBy(orderItems.sku, orderItems.optionLabel)
    .orderBy(desc(sql`sum(${orderItems.qty})`))
    .limit(limit);
}

/** Donations (Wine To Water round-ups) per day or month in a range, plus the detail rows. */
export async function donations(from: string, to: string) {
  const db = getDb();
  const span = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
  const byMonth = span > 90;
  const bucket = byMonth ? sql<string>`substr(${orders.placedAt}, 1, 7)` : sql<string>`substr(${orders.placedAt}, 1, 10)`;
  const where = and(gte(orders.placedAt, from), lt(orders.placedAt, sql`date(${to}, '+1 day')`), sql`${orders.donationCents} > 0`, inArray(orders.status, [...PAID_STATUSES, 'refunded']));
  const [series, detail] = await Promise.all([
    db.select({ bucket, count: sql<number>`count(*)`, amountCents: sql<number>`sum(${orders.donationCents})` }).from(orders).where(where).groupBy(bucket).orderBy(bucket),
    db.select({ number: orders.number, customerId: orders.customerId, email: orders.email, placedAt: orders.placedAt, amountCents: orders.donationCents }).from(orders).where(where).orderBy(desc(orders.placedAt)).limit(1000),
  ]);
  return { series, detail, byMonth, totalCents: series.reduce((a, r) => a + r.amountCents, 0), count: series.reduce((a, r) => a + r.count, 0) };
}

/** Marketplace orders per day (≤ 90 days) by marketplace. */
export async function marketplaceTrend(days: number) {
  const day = sql<string>`substr(${orders.placedAt}, 1, 10)`;
  const rows = await getDb()
    .select({ day, source: sourceExpr, count: sql<number>`count(*)`, totalCents: sql<number>`sum(${orders.totalCents})` })
    .from(orders)
    .where(and(gte(orders.placedAt, daysAgo(Math.min(90, days))), sql`${sourceExpr} in ('amazon', 'walmart', 'ebay')`))
    .groupBy(day, sourceExpr)
    .orderBy(desc(day));
  const byDay = new Map<string, Record<string, { count: number; totalCents: number }>>();
  for (const r of rows) (byDay.get(r.day) ?? byDay.set(r.day, {}).get(r.day)!)[r.source] = { count: r.count, totalCents: r.totalCents };
  return Array.from({ length: Math.min(90, days) }, (_, i) => {
    const d = daysAgo(i);
    const m = byDay.get(d) ?? {};
    return { day: d, ...Object.fromEntries(MARKETPLACES.map((mp) => [mp, m[mp] ?? { count: 0, totalCents: 0 }])) } as { day: string } & Record<Source, { count: number; totalCents: number }>;
  });
}

export async function marketplaceDetails(days: number) {
  return getDb()
    .select({ number: orders.number, placedAt: orders.placedAt, status: orders.status, source: sourceExpr, attribution: orders.attribution, email: orders.email, totalCents: orders.totalCents })
    .from(orders)
    .where(and(gte(orders.placedAt, daysAgo(Math.min(8, days))), sql`${sourceExpr} in ('amazon', 'walmart', 'ebay')`))
    .orderBy(desc(orders.placedAt))
    .limit(1000);
}

/**
 * Sales, cost of goods and profit per source over the last N days (legacy SA_stats_google's
 * CPC profit grids, generalised to every source). Cost follows the legacy waterfall: the
 * product's cost, else its paired parent's.
 */
export async function channelProfit(days = 21) {
  const cost = sql<number>`coalesce(${products.costCents}, (select p2.cost_cents from products p2 where p2.id = ${products.parentProductId}), 0)`;
  return getDb()
    .select({ source: sourceExpr, orders: sql<number>`count(distinct ${orders.id})`, qty: sql<number>`sum(${orderItems.qty})`, revenueCents: sql<number>`sum((${orderItems.unitPriceCents} - ${orderItems.discountCents}) * ${orderItems.qty})`, costCents: sql<number>`sum(${cost} * ${orderItems.qty})` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(and(gte(orders.placedAt, daysAgo(days)), inArray(orders.status, [...PAID_STATUSES])))
    .groupBy(sourceExpr)
    .orderBy(desc(sql`sum((${orderItems.unitPriceCents} - ${orderItems.discountCents}) * ${orderItems.qty})`));
}

/** Last gateway calls (legacy SA_pay_processing shows 100), optionally for one customer or order. */
export async function listPaymentLogs(f: { customerId?: number | null; orderNumber?: string | null; limit?: number } = {}) {
  return getDb()
    .select()
    .from(paymentLogs)
    .where(and(f.customerId ? eq(paymentLogs.customerId, f.customerId) : undefined, f.orderNumber ? eq(paymentLogs.orderNumber, f.orderNumber) : undefined))
    .orderBy(desc(paymentLogs.id))
    .limit(f.limit ?? 100);
}

export const PURCHASER_STATUSES = ['paid', 'processing', 'shipped', 'complete', 'pending', 'cancelled', 'refunded'] as const;

/** Distinct purchasers of the given SKUs (legacy sa_purchaser_export), excluding staff addresses. */
export async function purchasers(skus: string[], statuses: string[], sinceDays: number | null) {
  const clean = skus.map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 50);
  if (!clean.length) return [];
  return getDb()
    .select({ customerId: orders.customerId, email: orders.email, firstName: sql<string>`max(json_extract(${orders.billingAddress}, '$.firstName'))`, lastName: sql<string>`max(json_extract(${orders.billingAddress}, '$.lastName'))`, sku: orderItems.sku, orders: sql<number>`count(distinct ${orders.id})`, lastOrder: sql<string>`max(${orders.placedAt})` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(inArray(sql`upper(${orderItems.sku})`, clean), statuses.length ? inArray(orders.status, statuses) : undefined, sinceDays ? gte(orders.placedAt, daysAgo(sinceDays)) : undefined, sql`lower(${orders.email}) not like '%@filtersfast%'`))
    .groupBy(orders.email, orderItems.sku)
    .orderBy(asc(orderItems.sku), asc(orders.email))
    .limit(5000);
}

export { today, daysAgo };
