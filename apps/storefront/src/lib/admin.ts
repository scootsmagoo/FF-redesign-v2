import { and, desc, eq, or, sql } from 'drizzle-orm';
import { account, addresses, admins, customers, orderItems, orders, products, shipments, siteSettings, user } from '@ff/db';
import { getDb } from './db';

/**
 * Back-office queries for /manager. Every caller already has `locals.admin` (middleware
 * guards /manager pages; actions call `requireAdmin`).
 */

export const ORDER_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'complete', 'cancelled', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ADMIN_PAGE = 50;

const dayOf = (col: typeof orders.placedAt) => sql`substr(${col}, 1, 10)`;

export async function getDashboard() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const [[o], [c], [p], [a], recent] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`,
        today: sql<number>`coalesce(sum(case when ${dayOf(orders.placedAt)} = ${today} then 1 else 0 end), 0)`,
        revenueTodayCents: sql<number>`coalesce(sum(case when ${dayOf(orders.placedAt)} = ${today} then ${orders.totalCents} else 0 end), 0)`,
        open: sql<number>`coalesce(sum(case when ${orders.status} in ('pending', 'paid', 'processing') then 1 else 0 end), 0)`,
      })
      .from(orders),
    db.select({ n: sql<number>`count(*)` }).from(customers),
    db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.active, true)),
    db.select({ n: sql<number>`count(*)` }).from(admins).where(eq(admins.active, true)),
    db
      .select({ number: orders.number, email: orders.email, status: orders.status, totalCents: orders.totalCents, placedAt: orders.placedAt })
      .from(orders)
      .orderBy(desc(orders.placedAt))
      .limit(10),
  ]);
  return {
    orders: { total: o?.total ?? 0, today: o?.today ?? 0, revenueTodayCents: o?.revenueTodayCents ?? 0, open: o?.open ?? 0 },
    customers: c?.n ?? 0,
    products: p?.n ?? 0,
    admins: a?.n ?? 0,
    recent,
  };
}

// ---------- orders ----------

export async function listOrdersAdmin(opts: { q?: string; status?: string; page?: number }) {
  const db = getDb();
  const page = Math.max(1, opts.page ?? 1);
  const q = opts.q?.trim() ?? '';
  const pattern = `%${q}%`;
  const where = and(
    opts.status && (ORDER_STATUSES as readonly string[]).includes(opts.status) ? eq(orders.status, opts.status) : undefined,
    q ? or(sql`upper(${orders.number}) like upper(${pattern})`, sql`lower(${orders.email}) like lower(${pattern})`) : undefined,
  );
  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: orders.id,
        number: orders.number,
        email: orders.email,
        status: orders.status,
        totalCents: orders.totalCents,
        placedAt: orders.placedAt,
        customerId: orders.customerId,
        itemCount: sql<number>`(select coalesce(sum(qty), 0) from order_items oi where oi.order_id = ${orders.id})`,
      })
      .from(orders)
      .where(where)
      .orderBy(desc(orders.placedAt))
      .limit(ADMIN_PAGE)
      .offset((page - 1) * ADMIN_PAGE),
    db.select({ n: sql<number>`count(*)` }).from(orders).where(where),
  ]);
  return { rows, total: count?.n ?? 0, page, pageSize: ADMIN_PAGE };
}

export async function getOrderAdmin(number: string) {
  const db = getDb();
  const order = await db.query.orders.findFirst({ where: sql`upper(${orders.number}) = upper(${number.trim()})` });
  if (!order) return null;
  const [items, ships, customer] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db.select().from(shipments).where(eq(shipments.orderId, order.id)).orderBy(desc(shipments.id)),
    order.customerId ? db.query.customers.findFirst({ columns: { id: true, email: true, firstName: true, lastName: true }, where: eq(customers.id, order.customerId) }) : Promise.resolve(undefined),
  ]);
  return { order, items, shipments: ships, customer: customer ?? null };
}

export async function updateOrderStatus(orderId: number, status: OrderStatus) {
  await getDb().update(orders).set({ status }).where(eq(orders.id, orderId));
}

export async function addShipment(orderId: number, carrier: string, trackingNumber: string) {
  const db = getDb();
  await db.insert(shipments).values({ orderId, carrier, trackingNumber, shippedAt: new Date().toISOString() });
  await db.update(orders).set({ status: 'shipped' }).where(and(eq(orders.id, orderId), sql`${orders.status} in ('pending', 'paid', 'processing')`));
}

// ---------- customers ----------

export async function searchCustomers(qIn: string, page = 1) {
  const db = getDb();
  const q = qIn.trim();
  const pattern = `%${q}%`;
  const where = q
    ? or(
        sql`lower(${customers.email}) like lower(${pattern})`,
        sql`lower(coalesce(${customers.firstName}, '') || ' ' || coalesce(${customers.lastName}, '')) like lower(${pattern})`,
        /^\d+$/.test(q) ? eq(customers.id, Number(q)) : undefined,
      )
    : undefined;
  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: customers.id,
        email: customers.email,
        firstName: customers.firstName,
        lastName: customers.lastName,
        createdAt: customers.createdAt,
        guest: customers.guest,
        userId: user.id,
        orderCount: sql<number>`(select count(*) from orders o where o.customer_id = ${customers.id})`,
      })
      .from(customers)
      .leftJoin(user, eq(user.customerId, customers.id))
      .where(where)
      .orderBy(desc(customers.id))
      .limit(ADMIN_PAGE)
      .offset((Math.max(1, page) - 1) * ADMIN_PAGE),
    db.select({ n: sql<number>`count(*)` }).from(customers).where(where),
  ]);
  return { rows, total: count?.n ?? 0, page: Math.max(1, page), pageSize: ADMIN_PAGE };
}

export async function getCustomerAdmin(id: number) {
  const db = getDb();
  const customer = await db.query.customers.findFirst({ where: eq(customers.id, id) });
  if (!customer) return null;
  const [authUser, orderRows, addressRows] = await Promise.all([
    db.select({ id: user.id, emailVerified: user.emailVerified, createdAt: user.createdAt }).from(user).where(eq(user.customerId, id)).limit(1),
    db
      .select({ number: orders.number, status: orders.status, totalCents: orders.totalCents, placedAt: orders.placedAt })
      .from(orders)
      .where(or(eq(orders.customerId, id), sql`lower(${orders.email}) = lower(${customer.email})`))
      .orderBy(desc(orders.placedAt))
      .limit(50),
    db.select().from(addresses).where(eq(addresses.customerId, id)),
  ]);
  let credential: 'legacy' | 'scrypt' | 'none' = 'none';
  if (authUser[0]) {
    const acct = await db.select({ password: account.password }).from(account).where(and(eq(account.userId, authUser[0].id), eq(account.providerId, 'credential'))).limit(1);
    credential = acct[0]?.password ? (acct[0].password.startsWith('legacy:') ? 'legacy' : 'scrypt') : 'none';
  }
  return { customer, authUser: authUser[0] ?? null, credential, orders: orderRows, addresses: addressRows };
}

// ---------- settings ----------

export async function listSettings() {
  return getDb().select().from(siteSettings).orderBy(siteSettings.key);
}

export async function updateSetting(key: string, value: string) {
  JSON.parse(value); // throws on invalid JSON; values are stored as JSON
  await getDb()
    .insert(siteSettings)
    .values({ key, value, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date().toISOString() } });
}
