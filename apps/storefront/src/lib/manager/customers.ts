import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { account, addresses, applianceModels, backorderRequests, customerAppliances, customerMerges, customers, orderCredits, orders, productReminders, products, session, user } from '@ff/db';
import { getDb } from '../db';
import { offsetFor, PAGE_SIZE } from './util';

/**
 * Customer operations for the manager (legacy SA_cust*, sa_cust_merge*, sa_cust_models,
 * sa_cust_paylogs, SA_backorder_notifications).
 */

export class CustomerError extends Error {}

const nowIso = () => new Date().toISOString();

export interface CustomerFilter {
  q?: string;
  field?: 'any' | 'id' | 'email' | 'name' | 'phone' | 'company' | 'address';
  status?: 'active' | 'inactive' | '';
  hasLogin?: boolean | null;
  page?: number;
}

export async function listCustomersManager(f: CustomerFilter) {
  const db = getDb();
  const q = (f.q ?? '').trim();
  const conds = [];
  if (q) {
    const p = `%${q}%`;
    const digits = q.replace(/\D/g, '');
    const [first, ...rest] = q.split(/\s+/);
    const name = rest.length ? and(like(customers.firstName, `${first}%`), like(customers.lastName, `${rest.join(' ')}%`)) : or(like(customers.firstName, `${q}%`), like(customers.lastName, `${q}%`));
    const byField = {
      id: eq(customers.id, Number(q) || -1),
      email: like(customers.email, p),
      name,
      phone: digits ? sql`replace(replace(replace(replace(coalesce(${customers.phone}, ''), '-', ''), ' ', ''), '(', ''), ')', '') like ${`%${digits}%`}` : sql`1 = 0`,
      company: like(customers.company, p),
      address: sql`exists (select 1 from addresses a where a.customer_id = ${customers.id} and (a.line1 like ${p} or a.city like ${p} or a.postal_code like ${p}))`,
    };
    const field = f.field && f.field !== 'any' ? f.field : null;
    if (field) conds.push(byField[field]);
    else conds.push(or(/^\d+$/.test(q) ? byField.id : undefined, byField.email, name, digits.length >= 7 ? byField.phone : undefined, like(customers.company, p)));
  }
  if (f.status) conds.push(eq(customers.status, f.status));
  if (f.hasLogin === true) conds.push(sql`exists (select 1 from auth_user u where u.customer_id = ${customers.id})`);
  if (f.hasLogin === false) conds.push(sql`not exists (select 1 from auth_user u where u.customer_id = ${customers.id})`);
  const where = conds.length ? and(...conds) : undefined;
  const page = Math.max(1, f.page ?? 1);
  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: customers.id,
        email: customers.email,
        firstName: customers.firstName,
        lastName: customers.lastName,
        phone: customers.phone,
        company: customers.company,
        status: customers.status,
        guest: customers.guest,
        createdAt: customers.createdAt,
        userId: user.id,
        orderCount: sql<number>`(select count(*) from orders o where o.customer_id = ${customers.id})`,
        lastOrderAt: sql<string | null>`(select max(placed_at) from orders o where o.customer_id = ${customers.id})`,
      })
      .from(customers)
      .leftJoin(user, eq(user.customerId, customers.id))
      .where(where)
      .orderBy(desc(customers.id))
      .limit(PAGE_SIZE)
      .offset(offsetFor(page)),
    db.select({ n: sql<number>`count(*)` }).from(customers).where(where),
  ]);
  return { rows, total: count?.n ?? 0, page, pageSize: PAGE_SIZE };
}

export async function getCustomerManager(id: number) {
  const db = getDb();
  const customer = await db.query.customers.findFirst({ where: eq(customers.id, id) });
  if (!customer) return null;
  const [authUser, orderRows, addressRows, appliances, reminders, credits, merges, sessions] = await Promise.all([
    db.select({ id: user.id, emailVerified: user.emailVerified, createdAt: user.createdAt, name: user.name }).from(user).where(eq(user.customerId, id)).limit(1),
    db
      .select({ id: orders.id, number: orders.number, status: orders.status, totalCents: orders.totalCents, placedAt: orders.placedAt, attribution: orders.attribution })
      .from(orders)
      .where(or(eq(orders.customerId, id), sql`lower(${orders.email}) = lower(${customer.email})`))
      .orderBy(desc(orders.placedAt))
      .limit(100),
    db.select().from(addresses).where(eq(addresses.customerId, id)),
    db
      .select({ id: customerAppliances.id, nickname: customerAppliances.nickname, createdAt: customerAppliances.createdAt, modelNumber: applianceModels.modelNumber, brandName: applianceModels.brandName, modelId: applianceModels.id })
      .from(customerAppliances)
      .innerJoin(applianceModels, eq(applianceModels.id, customerAppliances.modelId))
      .where(eq(customerAppliances.customerId, id))
      .orderBy(desc(customerAppliances.createdAt)),
    db
      .select({ id: productReminders.id, months: productReminders.months, active: productReminders.active, createdAt: productReminders.createdAt, sku: products.sku, name: products.name, productId: productReminders.productId })
      .from(productReminders)
      .leftJoin(products, eq(products.id, productReminders.productId))
      .where(eq(productReminders.customerId, id))
      .orderBy(desc(productReminders.createdAt))
      .limit(100),
    db.select({ credit: orderCredits, number: orders.number }).from(orderCredits).innerJoin(orders, eq(orders.id, orderCredits.orderId)).where(eq(orderCredits.customerId, id)).orderBy(desc(orderCredits.id)).limit(50),
    db.select().from(customerMerges).where(or(eq(customerMerges.toCustomerId, id), eq(customerMerges.fromCustomerId, id))).orderBy(desc(customerMerges.id)).limit(50),
    Promise.resolve([] as { id: string }[]),
  ]);
  let credential: 'legacy' | 'scrypt' | 'none' = 'none';
  let activeSessions = 0;
  if (authUser[0]) {
    const acct = await db.select({ password: account.password }).from(account).where(and(eq(account.userId, authUser[0].id), eq(account.providerId, 'credential'))).limit(1);
    credential = acct[0]?.password ? (acct[0].password.startsWith('legacy:') ? 'legacy' : 'scrypt') : 'none';
    const [s] = await db.select({ n: sql<number>`count(*)` }).from(session).where(and(eq(session.userId, authUser[0].id), sql`${session.expiresAt} > ${nowIso()}`));
    activeSessions = s?.n ?? 0;
  }
  const totalSpentCents = orderRows.filter((o) => ['paid', 'processing', 'shipped', 'complete'].includes(o.status)).reduce((s, o) => s + o.totalCents, 0);
  void sessions;
  return { customer, authUser: authUser[0] ?? null, credential, activeSessions, orders: orderRows, addresses: addressRows, appliances, reminders, credits: credits.map((c) => ({ ...c.credit, number: c.number })), merges, totalSpentCents };
}

export interface CustomerEditInput {
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  company: string | null;
  newsletter: boolean;
  smsOptIn: boolean;
  isEmployee: boolean;
  isMilitary: boolean;
  reminderMonths: number | null;
}

export async function updateCustomer(id: number, input: CustomerEditInput): Promise<{ emailChanged: boolean }> {
  const db = getDb();
  const c = await db.query.customers.findFirst({ where: eq(customers.id, id) });
  if (!c) throw new CustomerError('Customer not found.');
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CustomerError('Enter a valid email address.');
  const emailChanged = email !== c.email;
  if (emailChanged) {
    const dup = await db.select({ id: customers.id }).from(customers).where(eq(customers.email, email)).limit(1);
    if (dup[0]) throw new CustomerError(`Another customer (#${dup[0].id}) already uses ${email}. Merge the accounts instead.`);
  }
  await db
    .update(customers)
    .set({ email, firstName: input.firstName?.trim() || null, lastName: input.lastName?.trim() || null, phone: input.phone?.trim() || null, company: input.company?.trim() || null, newsletter: input.newsletter, smsOptIn: input.smsOptIn, isEmployee: input.isEmployee, isMilitary: input.isMilitary, reminderMonths: input.reminderMonths })
    .where(eq(customers.id, id));
  if (emailChanged) {
    // keep the sign-in identity in step and sign the customer out everywhere (legacy intent: revoke stored payment tokens on an email change)
    const u = await db.select({ id: user.id }).from(user).where(eq(user.customerId, id)).limit(1);
    if (u[0]) {
      await db.update(user).set({ email, updatedAt: new Date() }).where(eq(user.id, u[0].id));
      await db.delete(session).where(eq(session.userId, u[0].id));
    }
  }
  return { emailChanged };
}

/** Inactive customers cannot sign in (checked by the storefront sign-in); their sessions are dropped now. */
export async function setCustomerStatus(id: number, status: 'active' | 'inactive'): Promise<void> {
  const db = getDb();
  await db.update(customers).set({ status }).where(eq(customers.id, id));
  if (status === 'inactive') {
    const u = await db.select({ id: user.id }).from(user).where(eq(user.customerId, id)).limit(1);
    if (u[0]) await db.delete(session).where(eq(session.userId, u[0].id));
  }
}

export async function setTaxExempt(id: number, taxExempt: boolean, until: string | null): Promise<void> {
  await getDb().update(customers).set({ taxExempt, taxExemptUntil: taxExempt ? until || null : null }).where(eq(customers.id, id));
}

export async function addCustomerNote(id: number, text: string, adminEmail: string): Promise<void> {
  const db = getDb();
  const c = await db.query.customers.findFirst({ columns: { notes: true }, where: eq(customers.id, id) });
  if (!c) throw new CustomerError('Customer not found.');
  const t = text.trim();
  if (!t) throw new CustomerError('Note is empty.');
  const line = `${nowIso().slice(0, 16).replace('T', ' ')} ${adminEmail}: ${t}`;
  await db.update(customers).set({ notes: `${line}\n${c.notes ?? ''}`.trim() }).where(eq(customers.id, id));
}

/** Signs the customer out of every device (legacy "unlock" / security reset). */
export async function revokeCustomerSessions(id: number): Promise<number> {
  const db = getDb();
  const u = await db.select({ id: user.id }).from(user).where(eq(user.customerId, id)).limit(1);
  if (!u[0]) return 0;
  const r = await db.delete(session).where(eq(session.userId, u[0].id)).returning({ id: session.id });
  return r.length;
}

export async function deleteCustomer(id: number): Promise<void> {
  const db = getDb();
  const [o] = await db.select({ n: sql<number>`count(*)` }).from(orders).where(eq(orders.customerId, id));
  if ((o?.n ?? 0) > 0) throw new CustomerError('Customers with orders cannot be deleted; deactivate the account instead.');
  const u = await db.select({ id: user.id }).from(user).where(eq(user.customerId, id)).limit(1);
  if (u[0]) await db.delete(user).where(eq(user.id, u[0].id));
  await db.delete(customers).where(eq(customers.id, id));
}

// ---------- merge ----------

export async function previewMerge(targetId: number, mode: 'customer' | 'order', ids: number[]) {
  const db = getDb();
  if (!ids.length) return [];
  const rows = await db
    .select({ id: orders.id, number: orders.number, customerId: orders.customerId, email: orders.email, placedAt: orders.placedAt, totalCents: orders.totalCents, status: orders.status, attribution: orders.attribution })
    .from(orders)
    .where(and(mode === 'customer' ? inArray(orders.customerId, ids.slice(0, 90)) : inArray(orders.id, ids.slice(0, 90)), sql`coalesce(${orders.customerId}, -1) <> ${targetId}`))
    .orderBy(asc(orders.customerId), desc(orders.id));
  return rows;
}

export async function findCustomerIdsByEmail(email: string, excludeId: number): Promise<number[]> {
  const db = getDb();
  const e = email.trim().toLowerCase();
  const direct = await db.select({ id: customers.id }).from(customers).where(and(like(customers.email, e), sql`${customers.id} <> ${excludeId}`));
  const viaOrders = await db.select({ id: orders.customerId }).from(orders).where(and(sql`lower(${orders.email}) = ${e}`, sql`coalesce(${orders.customerId}, -1) <> ${excludeId}`)).groupBy(orders.customerId);
  return [...new Set([...direct.map((d) => d.id), ...viaOrders.map((v) => v.id).filter((x): x is number => x !== null)])];
}

/** Moves the orders (by source customers or by order ids) onto the target and, optionally, deactivates the emptied accounts. */
export async function executeMerge(targetId: number, mode: 'customer' | 'order', ids: number[], deactivateSources: boolean, adminEmail: string): Promise<number> {
  const db = getDb();
  const target = await db.query.customers.findFirst({ columns: { id: true, email: true }, where: eq(customers.id, targetId) });
  if (!target) throw new CustomerError('Target customer not found.');
  const rows = await previewMerge(targetId, mode, ids);
  for (const o of rows) {
    await db.insert(customerMerges).values({ toCustomerId: targetId, fromCustomerId: o.customerId, orderId: o.id, adminEmail });
    await db.update(orders).set({ customerId: targetId }).where(eq(orders.id, o.id));
  }
  if (deactivateSources) {
    const sources = [...new Set(rows.map((r) => r.customerId).filter((x): x is number => x !== null && x !== targetId))];
    for (const s of sources) await setCustomerStatus(s, 'inactive');
  }
  await db.update(customers).set({ status: 'active' }).where(eq(customers.id, targetId));
  return rows.length;
}

// ---------- backorder requests ----------

export async function listBackorderRequests() {
  const db = getDb();
  const grouped = await db
    .select({
      productId: backorderRequests.productId,
      optionId: backorderRequests.optionId,
      requests: sql<number>`count(*)`,
      oldest: sql<string>`min(${backorderRequests.createdAt})`,
      sku: products.sku,
      name: products.name,
      stock: products.stock,
      actualInventory: products.actualInventory,
      ignoreStock: products.ignoreStock,
      blockedReason: products.blockedReason,
      popRank: products.popRank,
    })
    .from(backorderRequests)
    .innerJoin(products, eq(products.id, backorderRequests.productId))
    .where(and(sql`${backorderRequests.notifiedAt} is null`, sql`${backorderRequests.createdAt} >= datetime('now', '-1 year')`))
    .groupBy(backorderRequests.productId, backorderRequests.optionId)
    .orderBy(desc(sql`count(*)`))
    .limit(500);
  return grouped.map((g) => ({ ...g, ready: g.stock > 0 || g.ignoreStock }));
}

export async function listBackorderEmails(productId: number, optionId: number | null) {
  return getDb()
    .select()
    .from(backorderRequests)
    .where(and(eq(backorderRequests.productId, productId), optionId ? eq(backorderRequests.optionId, optionId) : sql`${backorderRequests.optionId} is null`, sql`${backorderRequests.notifiedAt} is null`))
    .orderBy(asc(backorderRequests.createdAt));
}

export async function markBackordersNotified(productId: number, optionId: number | null): Promise<number> {
  const r = await getDb()
    .update(backorderRequests)
    .set({ notifiedAt: nowIso() })
    .where(and(eq(backorderRequests.productId, productId), optionId ? eq(backorderRequests.optionId, optionId) : sql`${backorderRequests.optionId} is null`, sql`${backorderRequests.notifiedAt} is null`))
    .returning({ id: backorderRequests.id });
  return r.length;
}
