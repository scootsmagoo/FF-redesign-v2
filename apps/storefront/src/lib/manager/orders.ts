import { and, asc, desc, eq, gte, inArray, like, lte, or, sql } from 'drizzle-orm';
import { carts, cartItems, customers, orderCredits, orderItems, orders, returnItems, returns, shipments } from '@ff/db';
import { CANCEL_REASONS, CREDIT_REASONS, recomputeOrderTotal } from '@ff/domain/order-adjustment';
import type { Address } from '@ff/integrations';
import { getDb } from '../db';
import { sendRendered } from '../emails';
import { getProviders } from '../providers';
import { ORDER_STATUSES, type OrderStatus } from '../admin';
import { offsetFor, PAGE_SIZE } from './util';
import { renderOrderConfirmation } from '@ff/domain/emails';
import { loadOrderEmailData } from '../emails';

/**
 * Order operations for the manager beyond the basics in ../admin.ts (legacy SA_order*,
 * SA_order_exec, order_adjustment, SA_return, SA_order_credits, credits/client.asp).
 */

export class OrderError extends Error {}

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending (payment not confirmed)',
  paid: 'Paid',
  processing: 'Processing',
  shipped: 'Shipped',
  complete: 'Complete',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const nowIso = () => new Date().toISOString();
const stamp = (admin: string, text: string) => `${nowIso().slice(0, 16).replace('T', ' ')} ${admin}: ${text}`;

// ---------- list ----------

export interface OrderFilter {
  q?: string;
  field?: 'any' | 'number' | 'customer' | 'email' | 'name' | 'phone' | 'address' | 'company' | 'sku' | 'ref';
  status?: string;
  from?: string;
  to?: string;
  minTotalCents?: number | null;
  attribution?: string;
  page?: number;
}

export async function listOrdersManager(f: OrderFilter) {
  const db = getDb();
  const q = (f.q ?? '').trim();
  const conds = [];
  if (q) {
    const p = `%${q}%`;
    const digits = q.replace(/\D/g, '');
    const [first, ...rest] = q.split(/\s+/);
    const byField: Record<string, unknown> = {
      number: sql`upper(${orders.number}) = upper(${q}) or ${orders.legacyOrderId} = ${Number(q.replace(/^L/i, '')) || -1}`,
      customer: eq(orders.customerId, Number(q) || -1),
      email: like(orders.email, p),
      name: rest.length ? sql`(${orders.billingAddress} like ${`%"firstName":"${first}%`} and ${orders.billingAddress} like ${`%"lastName":"${rest.join(' ')}%`})` : or(sql`${orders.billingAddress} like ${`%"firstName":"${q}%`}`, sql`${orders.billingAddress} like ${`%"lastName":"${q}%`}`),
      phone: digits ? sql`replace(replace(replace(replace(${orders.billingAddress}, '-', ''), ' ', ''), '(', ''), ')', '') like ${`%${digits}%`} or replace(replace(replace(replace(${orders.shippingAddress}, '-', ''), ' ', ''), '(', ''), ')', '') like ${`%${digits}%`}` : sql`1 = 0`,
      address: or(like(orders.billingAddress, p), like(orders.shippingAddress, p)),
      company: sql`${orders.billingAddress} like ${`%"company":"%${q}%`}`,
      sku: sql`exists (select 1 from order_items oi where oi.order_id = ${orders.id} and upper(oi.sku) = upper(${q}))`,
      ref: or(like(orders.paymentRef, p), like(orders.attribution, p)),
    };
    const field = f.field && f.field !== 'any' ? f.field : null;
    if (field) conds.push(byField[field] as ReturnType<typeof eq>);
    else conds.push(or(byField.number as ReturnType<typeof eq>, like(orders.email, p), byField.name as ReturnType<typeof eq>, digits.length >= 7 ? (byField.phone as ReturnType<typeof eq>) : undefined, byField.sku as ReturnType<typeof eq>));
  }
  if (f.status && (ORDER_STATUSES as readonly string[]).includes(f.status)) conds.push(eq(orders.status, f.status));
  if (f.from) conds.push(gte(orders.placedAt, f.from));
  if (f.to) conds.push(lte(orders.placedAt, `${f.to}T23:59:59`));
  if (f.minTotalCents) conds.push(gte(orders.totalCents, f.minTotalCents));
  if (f.attribution === 'subscription') conds.push(like(orders.attribution, 'ordergroove%'));
  if (f.attribution === 'web') conds.push(or(sql`${orders.attribution} is null`, sql`${orders.attribution} not like 'ordergroove%'`));
  const where = conds.length ? and(...conds) : undefined;
  const page = Math.max(1, f.page ?? 1);
  const [rows, [count], [sum]] = await Promise.all([
    db
      .select({
        id: orders.id,
        number: orders.number,
        legacyOrderId: orders.legacyOrderId,
        customerId: orders.customerId,
        email: orders.email,
        status: orders.status,
        totalCents: orders.totalCents,
        placedAt: orders.placedAt,
        paymentProvider: orders.paymentProvider,
        attribution: orders.attribution,
        billingAddress: orders.billingAddress,
        shippingAddress: orders.shippingAddress,
        itemCount: sql<number>`(select coalesce(sum(qty), 0) from order_items oi where oi.order_id = ${orders.id})`,
        returnCount: sql<number>`(select count(*) from returns r where r.order_id = ${orders.id})`,
      })
      .from(orders)
      .where(where)
      .orderBy(desc(orders.placedAt))
      .limit(PAGE_SIZE)
      .offset(offsetFor(page)),
    db.select({ n: sql<number>`count(*)` }).from(orders).where(where),
    db.select({ s: sql<number>`coalesce(sum(total_cents), 0)` }).from(orders).where(where),
  ]);
  return { rows, total: count?.n ?? 0, totalCents: sum?.s ?? 0, page, pageSize: PAGE_SIZE };
}

export function parseAddress(json: string): Address {
  try {
    return JSON.parse(json) as Address;
  } catch {
    return { firstName: '', lastName: '', line1: '', city: '', region: '', postalCode: '', country: 'US' };
  }
}

// ---------- detail extras ----------

export async function getOrderExtras(orderId: number) {
  const db = getDb();
  const [credits, rets, customer] = await Promise.all([
    db.select().from(orderCredits).where(eq(orderCredits.orderId, orderId)).orderBy(desc(orderCredits.id)),
    db.select().from(returns).where(eq(returns.orderId, orderId)).orderBy(desc(returns.id)),
    Promise.resolve(null),
  ]);
  const retItems = rets.length ? await db.select().from(returnItems).where(inArray(returnItems.returnId, rets.map((r) => r.id))) : [];
  const creditedCents = credits.filter((c) => c.status !== 'failed').reduce((s, c) => s + c.amountCents, 0);
  return { credits, returns: rets.map((r) => ({ ...r, items: retItems.filter((i) => i.returnId === r.id) })), creditedCents, customer };
}

// ---------- edit ----------

export interface OrderEditInput {
  email: string;
  billing: Address;
  shipping: Address;
  shippingMethod: string | null;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  donationCents: number;
  adjustmentCents: number;
  salesCode: string | null;
}

/** Edits the customer-facing fields and money parts; the total follows the legacy rule. */
export async function editOrder(orderId: number, input: OrderEditInput, adminEmail: string): Promise<void> {
  const db = getDb();
  const o = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!o) throw new OrderError('Order not found.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new OrderError('Enter a valid email address.');
  for (const [label, a] of [
    ['Billing', input.billing],
    ['Shipping', input.shipping],
  ] as const) {
    if (!a.firstName.trim() || !a.lastName.trim() || !a.line1.trim() || !a.city.trim() || !a.postalCode.trim()) throw new OrderError(`${label} address needs name, street, city and postal code.`);
  }
  for (const [k, v] of Object.entries({ discount: input.discountCents, shipping: input.shippingCents, tax: input.taxCents, donation: input.donationCents })) if (v < 0) throw new OrderError(`${k} cannot be negative.`);
  const totalCents = recomputeOrderTotal({ subtotalCents: o.subtotalCents, discountCents: input.discountCents, shippingCents: input.shippingCents, taxCents: input.taxCents, donationCents: input.donationCents, adjustmentCents: input.adjustmentCents });
  if (totalCents < 0) throw new OrderError('The total would be negative.');
  const changes: string[] = [];
  if (o.email !== input.email) changes.push(`email ${o.email} → ${input.email}`);
  if (o.totalCents !== totalCents) changes.push(`total ${(o.totalCents / 100).toFixed(2)} → ${(totalCents / 100).toFixed(2)}`);
  if (JSON.stringify(parseAddress(o.shippingAddress)) !== JSON.stringify(input.shipping)) changes.push('shipping address changed');
  if (JSON.stringify(parseAddress(o.billingAddress)) !== JSON.stringify(input.billing)) changes.push('billing address changed');
  const note = changes.length ? stamp(adminEmail, `Edited: ${changes.join('; ')}`) : null;
  await db
    .update(orders)
    .set({
      email: input.email.toLowerCase(),
      billingAddress: JSON.stringify(input.billing),
      shippingAddress: JSON.stringify(input.shipping),
      shippingMethod: input.shippingMethod?.trim() || null,
      discountCents: input.discountCents,
      shippingCents: input.shippingCents,
      taxCents: input.taxCents,
      donationCents: input.donationCents,
      totalCents,
      salesCode: input.salesCode?.trim() || null,
      privateNotes: note ? `${note}\n${o.privateNotes ?? ''}`.trim() : o.privateNotes,
    })
    .where(eq(orders.id, orderId));
}

export async function addOrderNote(orderId: number, text: string, kind: 'private' | 'public', adminEmail: string): Promise<void> {
  const db = getDb();
  const o = await db.query.orders.findFirst({ columns: { privateNotes: true, publicNotes: true }, where: eq(orders.id, orderId) });
  if (!o) throw new OrderError('Order not found.');
  const t = text.trim();
  if (!t) throw new OrderError('Note is empty.');
  const line = stamp(adminEmail, t);
  if (kind === 'private') await db.update(orders).set({ privateNotes: `${line}\n${o.privateNotes ?? ''}`.trim() }).where(eq(orders.id, orderId));
  else await db.update(orders).set({ publicNotes: `${line}\n${o.publicNotes ?? ''}`.trim() }).where(eq(orders.id, orderId));
}

/**
 * Status change with the legacy side effects: cancellation needs a reason and stamps the date;
 * every change is appended to the public status history; the customer is emailed when asked.
 */
export async function changeOrderStatus(orderId: number, status: OrderStatus, opts: { cancelReason?: number | null; notify: boolean; note?: string | null }, adminEmail: string): Promise<{ emailed: boolean }> {
  const db = getDb();
  const o = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!o) throw new OrderError('Order not found.');
  if (!(ORDER_STATUSES as readonly string[]).includes(status)) throw new OrderError('Unknown status.');
  if (o.status === 'cancelled' && status !== 'cancelled') throw new OrderError('A cancelled order cannot be reopened; place a new order instead.');
  const set: Partial<typeof orders.$inferInsert> = { status };
  if (status === 'cancelled') {
    if (!opts.cancelReason || !CANCEL_REASONS[opts.cancelReason]) throw new OrderError('Choose a cancellation reason.');
    set.cancelReason = opts.cancelReason;
    set.cancelledAt = o.cancelledAt ?? nowIso();
  }
  if (o.status !== status) {
    const line = `${nowIso().slice(0, 16).replace('T', ' ')} Order status: ${STATUS_LABELS[status] ?? status}${status === 'cancelled' ? ` (${CANCEL_REASONS[opts.cancelReason!]})` : ''}`;
    set.publicNotes = `${line}\n${o.publicNotes ?? ''}`.trim();
  }
  if (opts.note?.trim()) set.privateNotes = `${stamp(adminEmail, opts.note.trim())}\n${o.privateNotes ?? ''}`.trim();
  await db.update(orders).set(set).where(eq(orders.id, orderId));

  let emailed = false;
  if (opts.notify && o.status !== status && ['cancelled', 'processing', 'complete', 'pending', 'refunded'].includes(status)) {
    const data = await loadOrderEmailData(orderId);
    if (data) {
      const subject = status === 'cancelled' ? `Your FiltersFast.com order ${o.number} has been cancelled` : `Update on your FiltersFast.com order ${o.number}`;
      const base = renderOrderConfirmation(data);
      const body = status === 'cancelled' ? `Order ${o.number} has been cancelled${opts.cancelReason === 1 ? ' at your request' : ''}. If a payment was captured it will be refunded to the original payment method within a few business days.` : `Order ${o.number} is now: ${STATUS_LABELS[status] ?? status}.`;
      const r = await sendRendered('order-confirmation', o.email, { subject, html: base.html.replace('Thanks for your order!', status === 'cancelled' ? 'Your order has been cancelled' : 'Order update').replace(/Hi [^,]*, we received order[^.]*\./, body), text: `${body}\n\n${base.text}`, templateData: { ...base.templateData, status, statusLabel: STATUS_LABELS[status] ?? status } });
      emailed = r.ok;
    }
  }
  return { emailed };
}

// ---------- credits / refunds ----------

export async function issueCredit(orderId: number, input: { amountCents: number; reason: string; note: string | null; method: 'original' | 'manual' }, adminEmail: string): Promise<{ id: number; status: string; error?: string }> {
  const db = getDb();
  const o = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!o) throw new OrderError('Order not found.');
  if (!['paid', 'processing', 'shipped', 'complete', 'cancelled', 'refunded'].includes(o.status)) throw new OrderError('Only paid orders can be credited.');
  if (input.amountCents <= 0) throw new OrderError('Amount must be positive.');
  if (!CREDIT_REASONS.includes(input.reason)) throw new OrderError('Choose a reason code.');
  const { creditedCents } = await getOrderExtras(orderId);
  if (creditedCents + input.amountCents > o.totalCents) throw new OrderError(`Credits would exceed the order total (${((o.totalCents - creditedCents) / 100).toFixed(2)} left).`);
  let status = 'success';
  let providerRef: string | null = null;
  let response: string | null = null;
  let error: string | undefined;
  if (input.method === 'original') {
    if (!o.paymentRef) throw new OrderError('This order has no payment reference to refund against; record a manual credit instead.');
    const r = await getProviders().payment.refund(o.paymentRef, input.amountCents, `${input.reason}${input.note ? `: ${input.note}` : ''}`);
    status = r.ok ? 'success' : 'failed';
    providerRef = r.transactionId ?? null;
    response = JSON.stringify(r.raw ?? { declineReason: r.declineReason }).slice(0, 2000);
    if (!r.ok) error = r.declineReason ?? 'The payment provider refused the refund.';
  }
  const [row] = await db
    .insert(orderCredits)
    .values({ orderId, customerId: o.customerId, amountCents: input.amountCents, currency: o.currency, method: input.method, reason: input.reason, note: input.note, status, providerRef, response, adminEmail })
    .returning({ id: orderCredits.id });
  if (status === 'success') {
    const line = stamp(adminEmail, `Credit ${(input.amountCents / 100).toFixed(2)} ${o.currency} (${input.reason})`);
    const fullyRefunded = creditedCents + input.amountCents >= o.totalCents;
    await db.update(orders).set({ privateNotes: `${line}\n${o.privateNotes ?? ''}`.trim(), ...(fullyRefunded && o.status !== 'cancelled' ? { status: 'refunded' } : {}) }).where(eq(orders.id, orderId));
  }
  return { id: row!.id, status, error };
}

export async function listCredits(opts: { orderId?: number | null; customerId?: number | null; page?: number }) {
  const db = getDb();
  const where = and(opts.orderId ? eq(orderCredits.orderId, opts.orderId) : undefined, opts.customerId ? eq(orderCredits.customerId, opts.customerId) : undefined);
  const page = Math.max(1, opts.page ?? 1);
  const [rows, [count]] = await Promise.all([
    db.select({ credit: orderCredits, number: orders.number }).from(orderCredits).innerJoin(orders, eq(orders.id, orderCredits.orderId)).where(where).orderBy(desc(orderCredits.id)).limit(PAGE_SIZE).offset(offsetFor(page)),
    db.select({ n: sql<number>`count(*)` }).from(orderCredits).where(where),
  ]);
  return { rows: rows.map((r) => ({ ...r.credit, number: r.number })), total: count?.n ?? 0, page, pageSize: PAGE_SIZE };
}

// ---------- returns ----------

export const RETURN_STATUSES = ['requested', 'label', 'approved', 'refunded', 'cancelled'] as const;

export async function createReturn(orderId: number, input: { items: { orderItemId: number; qty: number; reason: string; refundOnly: boolean }[]; feeCents: number; comment: string | null; labelTracking: string | null }, adminEmail: string): Promise<number> {
  const db = getDb();
  const o = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!o) throw new OrderError('Order not found.');
  const lines = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const chosen = input.items.filter((i) => i.qty > 0);
  if (!chosen.length) throw new OrderError('Choose at least one item to return.');
  let totalCents = 0;
  const rows = chosen.map((i) => {
    const l = lines.find((x) => x.id === i.orderItemId);
    if (!l) throw new OrderError('Unknown order line.');
    const qty = Math.min(l.qty, i.qty);
    const unit = l.unitPriceCents - Math.round(l.discountCents / Math.max(1, l.qty));
    totalCents += unit * qty;
    return { productId: l.productId, sku: l.sku, optionLabel: l.optionLabel, qty, unitPriceCents: unit, reason: i.reason || null, refundOnly: i.refundOnly };
  });
  const taxCents = o.subtotalCents > 0 ? Math.round((o.taxCents * totalCents) / (o.subtotalCents - o.discountCents || 1)) : 0;
  const [ret] = await db
    .insert(returns)
    .values({ orderId, customerId: o.customerId, status: input.labelTracking ? 'label' : 'requested', totalCents: totalCents + taxCents, feeCents: input.feeCents, taxCents, comment: input.comment, labelTracking: input.labelTracking, adminEmail })
    .returning({ id: returns.id });
  await db.insert(returnItems).values(rows.map((r) => ({ ...r, returnId: ret!.id })));
  await db.update(orders).set({ privateNotes: `${stamp(adminEmail, `Return #${ret!.id} opened (${rows.length} line(s), ${((totalCents + taxCents) / 100).toFixed(2)})`)}\n${o.privateNotes ?? ''}`.trim() }).where(eq(orders.id, orderId));
  return ret!.id;
}

export async function updateReturn(id: number, patch: { status?: string; feeCents?: number; comment?: string | null; labelTracking?: string | null }, adminEmail: string): Promise<void> {
  const db = getDb();
  const r = await db.query.returns.findFirst({ where: eq(returns.id, id) });
  if (!r) throw new OrderError('Return not found.');
  const set: Partial<typeof returns.$inferInsert> = {};
  if (patch.status) {
    if (!(RETURN_STATUSES as readonly string[]).includes(patch.status)) throw new OrderError('Unknown return status.');
    set.status = patch.status;
    if (patch.status === 'refunded') set.refundedAt = nowIso();
  }
  if (patch.feeCents !== undefined) set.feeCents = patch.feeCents;
  if (patch.comment !== undefined) set.comment = patch.comment;
  if (patch.labelTracking !== undefined) set.labelTracking = patch.labelTracking;
  set.adminEmail = adminEmail;
  await db.update(returns).set(set).where(eq(returns.id, id));
}

/** Approve + refund in one step: issues the credit for total − fee through the provider, then marks the return refunded. */
export async function refundReturn(id: number, adminEmail: string): Promise<{ creditId: number; status: string; error?: string }> {
  const db = getDb();
  const r = await db.query.returns.findFirst({ where: eq(returns.id, id) });
  if (!r) throw new OrderError('Return not found.');
  if (r.status === 'refunded') throw new OrderError('Already refunded.');
  const amount = r.totalCents - r.feeCents;
  if (amount <= 0) throw new OrderError('Nothing to refund after the fee.');
  const c = await issueCredit(r.orderId, { amountCents: amount, reason: 'RESTOCK', note: `Return #${r.id}`, method: 'original' }, adminEmail);
  if (c.status === 'success') await db.update(returns).set({ status: 'refunded', refundedAt: nowIso(), adminEmail }).where(eq(returns.id, id));
  return { creditId: c.id, status: c.status, error: c.error };
}

export async function listReturns(opts: { status?: string; page?: number }) {
  const db = getDb();
  const where = opts.status && (RETURN_STATUSES as readonly string[]).includes(opts.status) ? eq(returns.status, opts.status) : undefined;
  const page = Math.max(1, opts.page ?? 1);
  const [rows, [count]] = await Promise.all([
    db
      .select({ ret: returns, number: orders.number, email: orders.email, paymentProvider: orders.paymentProvider, itemCount: sql<number>`(select coalesce(sum(qty), 0) from return_items ri where ri.return_id = ${returns.id})` })
      .from(returns)
      .innerJoin(orders, eq(orders.id, returns.orderId))
      .where(where)
      .orderBy(asc(returns.status), desc(returns.id))
      .limit(PAGE_SIZE)
      .offset(offsetFor(page)),
    db.select({ n: sql<number>`count(*)` }).from(returns).where(where),
  ]);
  return { rows: rows.map((r) => ({ ...r.ret, number: r.number, email: r.email, paymentProvider: r.paymentProvider, itemCount: r.itemCount })), total: count?.n ?? 0, page, pageSize: PAGE_SIZE };
}

// ---------- housekeeping ----------

/** Legacy "delete unfinalized orders older than N hours": v2 keeps carts separately, so this purges stale carts. */
export async function purgeStaleCarts(hours: number): Promise<number> {
  const db = getDb();
  const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
  const stale = await db.select({ id: carts.id }).from(carts).where(and(lte(carts.updatedAt, cutoff), sql`${carts.customerId} is null`));
  if (!stale.length) return 0;
  for (let i = 0; i < stale.length; i += 90) {
    const ids = stale.slice(i, i + 90).map((c) => c.id);
    await db.delete(cartItems).where(inArray(cartItems.cartId, ids));
    await db.delete(carts).where(inArray(carts.id, ids));
  }
  return stale.length;
}

/** Large paid orders since a date (legacy sa_large_orders). */
export async function listLargeOrders(minTotalCents: number, sinceIso: string) {
  return getDb()
    .select({ id: orders.id, number: orders.number, customerId: orders.customerId, email: orders.email, placedAt: orders.placedAt, status: orders.status, totalCents: orders.totalCents, billingAddress: orders.billingAddress, paymentProvider: orders.paymentProvider })
    .from(orders)
    .where(and(gte(orders.totalCents, minTotalCents), gte(orders.placedAt, sinceIso), inArray(orders.status, ['paid', 'processing', 'shipped', 'complete'])))
    .orderBy(desc(orders.placedAt))
    .limit(500);
}

export async function transferOrderToCustomer(orderId: number, customerId: number, adminEmail: string): Promise<void> {
  const db = getDb();
  const c = await db.query.customers.findFirst({ columns: { id: true, email: true }, where: eq(customers.id, customerId) });
  if (!c) throw new OrderError(`Customer #${customerId} does not exist.`);
  const o = await db.query.orders.findFirst({ columns: { customerId: true, privateNotes: true }, where: eq(orders.id, orderId) });
  if (!o) throw new OrderError('Order not found.');
  await db.update(orders).set({ customerId, privateNotes: `${stamp(adminEmail, `Transferred from customer #${o.customerId ?? 'guest'} to #${customerId} (${c.email})`)}\n${o.privateNotes ?? ''}`.trim() }).where(eq(orders.id, orderId));
  const { customerMerges } = await import('@ff/db');
  await db.insert(customerMerges).values({ toCustomerId: customerId, fromCustomerId: o.customerId, orderId, adminEmail });
}

/** Home Filter Club (Ordergroove-inserted) orders in a date range: per-day summary plus the rows (legacy sa_subscriptions). */
export async function listSubscriptionOrders(fromIso: string, toIso: string) {
  const db = getDb();
  const where = and(like(orders.attribution, 'ordergroove%'), gte(orders.placedAt, fromIso), lte(orders.placedAt, `${toIso}T23:59:59`));
  const [days, rows] = await Promise.all([
    db
      .select({ day: sql<string>`substr(${orders.placedAt}, 1, 10)`, status: orders.status, n: sql<number>`count(*)`, totalCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)` })
      .from(orders)
      .where(where)
      .groupBy(sql`substr(${orders.placedAt}, 1, 10)`, orders.status)
      .orderBy(asc(sql`substr(${orders.placedAt}, 1, 10)`)),
    db
      .select({ id: orders.id, number: orders.number, customerId: orders.customerId, email: orders.email, placedAt: orders.placedAt, status: orders.status, totalCents: orders.totalCents, attribution: orders.attribution, paymentRef: orders.paymentRef })
      .from(orders)
      .where(where)
      .orderBy(desc(orders.placedAt))
      .limit(500),
  ]);
  return { days, rows };
}

export { CANCEL_REASONS, CREDIT_REASONS };
export type { OrderStatus };
export async function shipmentsFor(orderId: number) {
  return getDb().select().from(shipments).where(eq(shipments.orderId, orderId)).orderBy(desc(shipments.id));
}
