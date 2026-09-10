import { and, desc, eq, sql } from 'drizzle-orm';
import { addresses, customers, orderItems, orders, shipments } from '@ff/db';
import { getDb } from './db';

export async function getCustomer(customerId: number) {
  return getDb().query.customers.findFirst({ where: eq(customers.id, customerId) });
}

export async function listOrders(customerId: number, email: string, limit = 50) {
  // Legacy orders were imported with customer_id where the customer existed; fall back to email for guest orders.
  return getDb()
    .select({
      id: orders.id, number: orders.number, status: orders.status, totalCents: orders.totalCents, placedAt: orders.placedAt, shippingMethod: orders.shippingMethod,
      itemCount: sql<number>`(select coalesce(sum(qty), 0) from order_items oi where oi.order_id = ${orders.id})`,
    })
    .from(orders)
    .where(sql`${orders.customerId} = ${customerId} or lower(${orders.email}) = ${email.toLowerCase()}`)
    .orderBy(desc(orders.placedAt))
    .limit(limit);
}

export async function getOrderForCustomer(number: string, customerId: number, email: string) {
  const db = getDb();
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.number, number), sql`(${orders.customerId} = ${customerId} or lower(${orders.email}) = ${email.toLowerCase()})`),
  });
  if (!order) return null;
  return loadOrderDetail(order);
}

/** Guest lookup: order number + the email used at checkout (legacy TrackOrder.asp used idOrder + randomKey). */
export async function getOrderForGuest(number: string, email: string) {
  const db = getDb();
  const n = number.trim().toUpperCase();
  const order = await db.query.orders.findFirst({
    where: and(sql`upper(${orders.number}) = ${n}`, sql`lower(${orders.email}) = ${email.trim().toLowerCase()}`),
  });
  if (!order) return null;
  return loadOrderDetail(order);
}

async function loadOrderDetail(order: typeof orders.$inferSelect) {
  const db = getDb();
  const [items, ships] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db.select().from(shipments).where(eq(shipments.orderId, order.id)),
  ]);
  return { order, items, shipments: ships };
}

export async function listAddresses(customerId: number) {
  return getDb().select().from(addresses).where(eq(addresses.customerId, customerId)).orderBy(desc(addresses.isDefaultShipping), desc(addresses.id));
}

export async function deleteAddress(customerId: number, addressId: number) {
  await getDb().delete(addresses).where(and(eq(addresses.id, addressId), eq(addresses.customerId, customerId)));
}

export async function updateProfile(customerId: number, patch: { firstName?: string; lastName?: string; phone?: string; newsletter?: boolean; smsOptIn?: boolean }) {
  await getDb().update(customers).set(patch).where(eq(customers.id, customerId));
}
