import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { customers, inboundEvents, options, orders, products, quantityTiers } from '@ff/db';
import { tieredUnitPrice, type QuantityTier } from '@ff/domain/pricing';
import { OgOrderError, type OgOrder } from '@ff/domain/ordergroove';
import { env } from 'cloudflare:workers';
import { addShipment } from './admin';
import { generateOrderNumber, saveOrder } from './checkout';
import { getDb } from './db';
import { sendOrderConfirmation } from './emails';
import { getProviders } from './providers';

/**
 * Endpoints other systems call *into* the site (architecture doc §4a). Every call is logged in
 * `inbound_events`, keyed by (source, external id) so a retried delivery is answered with the
 * original outcome instead of creating a second order.
 */

type InboundEnv = {
  ORDERGROOVE_API_USER?: string;
  ORDERGROOVE_API_PASSWORD?: string;
  ORDERGROOVE_HASH_KEY?: string;
  AUTOMATION_TOKEN?: string;
};
const cfg = env as unknown as InboundEnv;

export type InboundSource = 'ordergroove' | 'wms' | 'shopify' | 'walmart';

/** Constant-time string compare so credential checks don't leak length/prefix timing. */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.byteLength !== eb.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < ea.byteLength; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

/** Ordergroove posts `username` + `password` form fields (legacy contract). Both must be configured. */
export function ordergrooveCredentialsOk(username: string | null | undefined, password: string | null | undefined): boolean {
  const u = cfg.ORDERGROOVE_API_USER?.trim();
  const p = cfg.ORDERGROOVE_API_PASSWORD;
  if (!u || !p) return false;
  return safeEqual(username ?? '', u) && safeEqual(password ?? '', p);
}

/** Bearer token (or `?token=` for callers that can only do GET) for internal automation such as the WMS. */
export function automationTokenOk(request: Request, url: URL): boolean {
  const expected = cfg.AUTOMATION_TOKEN;
  if (!expected) return false;
  const auth = request.headers.get('authorization') ?? '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const given = bearer || url.searchParams.get('token') || '';
  return given ? safeEqual(given, expected) : false;
}

export function ordergrooveHashKey(): string | undefined {
  return cfg.ORDERGROOVE_HASH_KEY || undefined;
}

export function clientIp(request: Request): string | null {
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

// ---------- event log ----------

export interface InboundEventRow {
  id: number;
  status: string;
  orderId: number | null;
  error: string | null;
}

/**
 * Records the call. Returns `{ event, duplicate }`: when the same (source, external id) was already
 * handled, `duplicate` is the earlier row so the caller can replay its answer.
 */
export async function recordInboundEvent(source: InboundSource, externalId: string, payload: string | null, remoteIp: string | null): Promise<{ event: InboundEventRow; duplicate: boolean }> {
  const db = getDb();
  const existing = await db
    .select({ id: inboundEvents.id, status: inboundEvents.status, orderId: inboundEvents.orderId, error: inboundEvents.error })
    .from(inboundEvents)
    .where(and(eq(inboundEvents.source, source), eq(inboundEvents.externalId, externalId)))
    .limit(1);
  if (existing[0]) return { event: existing[0], duplicate: true };
  const [row] = await db.insert(inboundEvents).values({ source, externalId, payload, remoteIp, status: 'received' }).returning({ id: inboundEvents.id });
  if (!row) throw new Error('Could not log the inbound event');
  return { event: { id: row.id, status: 'received', orderId: null, error: null }, duplicate: false };
}

export async function finishInboundEvent(id: number, result: { status: 'ok' | 'error'; orderId?: number | null; error?: string | null }) {
  await getDb()
    .update(inboundEvents)
    .set({ status: result.status, orderId: result.orderId ?? null, error: result.error ?? null })
    .where(eq(inboundEvents.id, id));
}

export async function listInboundEvents(opts: { source?: string; limit?: number } = {}) {
  const db = getDb();
  const where = opts.source ? eq(inboundEvents.source, opts.source) : undefined;
  return db
    .select({
      id: inboundEvents.id,
      source: inboundEvents.source,
      externalId: inboundEvents.externalId,
      status: inboundEvents.status,
      error: inboundEvents.error,
      remoteIp: inboundEvents.remoteIp,
      receivedAt: inboundEvents.receivedAt,
      orderId: inboundEvents.orderId,
      orderNumber: orders.number,
    })
    .from(inboundEvents)
    .leftJoin(orders, eq(orders.id, inboundEvents.orderId))
    .where(where)
    .orderBy(desc(inboundEvents.id))
    .limit(opts.limit ?? 100);
}

export async function getInboundEvent(id: number) {
  return getDb().query.inboundEvents.findFirst({ where: eq(inboundEvents.id, id) });
}

// ---------- Ordergroove: order insertion ----------

/**
 * Creates a Home Filter Club order from Ordergroove's XML. Prices are the ones Ordergroove sends
 * (it owns the subscription discount); products are checked to exist and the option label is
 * resolved for the order line. Payment goes through the configured provider with the customer's
 * vault token (`orderTokenId` when Ordergroove passes one, else the customer's default method).
 */
export async function createOrderFromOg(og: OgOrder): Promise<{ id: number; number: string }> {
  const db = getDb();

  const ids = [...new Set(og.items.map((i) => i.productId))];
  const prodRows = await db
    .select({ id: products.id, sku: products.sku, name: products.name, active: products.active })
    .from(products)
    .where(inArray(products.id, ids));
  const byId = new Map(prodRows.map((p) => [p.id, p]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) throw new OgOrderError(`Unknown product id(s): ${missing.join(', ')}`, 'UNKNOWN_PRODUCT');

  const optIds = [...new Set(og.items.map((i) => i.optionId).filter((x): x is number => x !== null))];
  const optRows = optIds.length ? await db.select({ id: options.id, label: options.label }).from(options).where(inArray(options.id, optIds)) : [];
  const optById = new Map(optRows.map((o) => [o.id, o.label]));

  // Attach to the customer Ordergroove names (legacy idCust), or match by email; otherwise a guest order.
  let customerId: number | null = null;
  const cust = await db
    .select({ id: customers.id })
    .from(customers)
    .where(og.customerId ? or(eq(customers.id, og.customerId), sql`lower(${customers.email}) = ${og.email}`) : sql`lower(${customers.email}) = ${og.email}`)
    .limit(2);
  customerId = cust.find((c) => c.id === og.customerId)?.id ?? cust[0]?.id ?? null;

  const lines = og.items.map((i) => {
    const p = byId.get(i.productId)!;
    return {
      productId: p.id,
      sku: i.sku || p.sku,
      name: i.name || p.name,
      optionLabel: i.optionId ? (optById.get(i.optionId) ?? null) : null,
      qty: i.qty,
      unitPriceCents: i.finalPriceCents,
      discountCents: 0,
      subscriptionMonths: null,
    };
  });

  // Totals: trust Ordergroove's head, but never let the stored parts disagree with the total.
  const merchandise = lines.reduce((s, l) => s + l.unitPriceCents * l.qty, 0);
  const subtotalCents = merchandise + og.discountCents;
  const totalCents = og.totalCents > 0 ? og.totalCents : merchandise + og.shippingCents + og.taxCents;

  const number = generateOrderNumber();
  const providers = getProviders();
  const payment = await providers.payment.authorizeAndCapture({
    orderNumber: number,
    amountCents: totalCents,
    currency: og.currency,
    method: og.paymentMethod.toLowerCase().includes('paypal') ? 'paypal' : 'card',
    token: og.tokenId || `vault:customer:${customerId ?? og.customerId ?? 'unknown'}`,
    billing: og.billing,
    customerEmail: og.email,
  });
  if (!payment.ok) throw new OgOrderError(payment.declineReason ?? 'Payment was declined', 'PAYMENT_DECLINED');

  const order = await saveOrder({
    number,
    customerId,
    email: og.email,
    status: 'paid',
    currency: og.currency,
    subtotalCents,
    discountCents: og.discountCents,
    shippingCents: og.shippingCents,
    taxCents: og.taxCents,
    totalCents,
    billing: og.billing,
    shipping: og.shipping,
    shippingMethod: 'Economy',
    paymentProvider: providers.payment.name,
    paymentRef: payment.transactionId ?? null,
    attribution: `ordergroove/hfc:${og.ogOrderId}`,
    lines,
  });
  await sendOrderConfirmation(order.id);
  return { id: order.id, number: order.number };
}

// ---------- Ordergroove: price API ----------

/** Current unit price for a product (+ option, quantity tier) in cents, or null when not sellable. */
export async function ogUnitPriceCents(productId: number, optionId: number | null, quantity: number): Promise<number | null> {
  const db = getDb();
  const p = await db.query.products.findFirst({ columns: { id: true, priceCents: true, active: true, parentProductId: true }, where: eq(products.id, productId) });
  if (!p || !p.active) return null;
  let base = p.priceCents;
  if (optionId) {
    const o = await db.query.options.findFirst({ columns: { priceAddCents: true, percentAdd: true }, where: eq(options.id, optionId) });
    if (o) base = Math.round((base + o.priceAddCents) * (1 + o.percentAdd / 100));
  }
  const owner = p.parentProductId ?? p.id;
  const tierRows = await db
    .select({ fromQty: quantityTiers.fromQty, toQty: quantityTiers.toQty, discountCents: quantityTiers.discountCents })
    .from(quantityTiers)
    .where(and(eq(quantityTiers.productId, owner), sql`${quantityTiers.source} is null`));
  const tiers: QuantityTier[] = tierRows.map((t) => ({ fromQty: t.fromQty, toQty: t.toQty, discountCents: t.discountCents }));
  return tieredUnitPrice(base, quantity, tiers);
}

// ---------- WMS ship confirmation ----------

export interface ShipConfirmInput {
  /** legacy idOrder, v2 order number, or "L<legacyId>" */
  orderRef: string;
  trackingNumber: string;
  carrier?: string | null;
  /** legacy `station` (USPS history); kept in the event log only */
  station?: string | null;
  notify?: boolean;
}

export async function shipConfirm(input: ShipConfirmInput): Promise<{ orderId: number; number: string; shipmentId: number | null; emailed: boolean }> {
  const ref = input.orderRef.trim();
  if (!ref) throw new Error('idorder is required');
  const tracking = input.trackingNumber.trim();
  if (tracking.length < 4) throw new Error('tracking is required');
  const db = getDb();
  const legacyId = /^L?(\d+)$/i.exec(ref)?.[1];
  const order = await db.query.orders.findFirst({
    columns: { id: true, number: true },
    where: legacyId ? or(eq(orders.legacyOrderId, Number(legacyId)), sql`upper(${orders.number}) = upper(${ref})`) : sql`upper(${orders.number}) = upper(${ref})`,
  });
  if (!order) throw new Error(`Order ${ref} not found`);
  const r = await addShipment(order.id, input.carrier?.trim() || 'USPS Priority Mail', tracking, input.notify ?? true);
  return { orderId: order.id, number: order.number, shipmentId: r.shipmentId, emailed: r.email?.ok ?? false };
}
