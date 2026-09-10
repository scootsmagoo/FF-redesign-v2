import { and, eq, sql } from 'drizzle-orm';
import { cartItems, carts, products } from '@ff/db';
import { computeCartTotals, type CartLineInput, type CartTotals } from '@ff/domain/cart';
import { env } from 'cloudflare:workers';
import { getDb } from './db';

type Session = { get<T = unknown>(key: string): Promise<T | undefined>; set(key: string, value: unknown): void } | undefined;

const CART_KEY = 'cartId';

/** Returns the current cart id from the session, or null if the visitor has no cart yet. */
export async function getCartId(session: Session): Promise<string | null> {
  const id = await session?.get<string>(CART_KEY);
  return id ?? null;
}

async function ensureCart(session: Session): Promise<string> {
  const existing = await getCartId(session);
  if (existing) {
    const row = await getDb().select({ id: carts.id }).from(carts).where(eq(carts.id, existing)).limit(1);
    if (row[0]) return existing;
  }
  if (!session) throw new Error('Sessions are not configured; cannot create a cart.');
  const id = crypto.randomUUID();
  await getDb().insert(carts).values({ id });
  session.set(CART_KEY, id);
  return id;
}

export interface AddItemInput {
  productId: number;
  qty: number;
  optionId?: number | null;
  subscriptionMonths?: number | null;
}

export async function addItem(session: Session, input: AddItemInput): Promise<{ cartId: string; itemCount: number }> {
  const db = getDb();
  const product = await db.query.products.findFirst({
    columns: { id: true, priceCents: true, stock: true, ignoreStock: true, active: true },
    where: eq(products.id, input.productId),
  });
  if (!product || !product.active) throw new Error('Product not found');
  if (product.stock <= 0 && !product.ignoreStock) throw new Error('Product is out of stock');

  const cartId = await ensureCart(session);
  const qty = Math.max(1, Math.min(99, Math.trunc(input.qty)));
  const optionId = input.optionId ?? null;
  const subscriptionMonths = input.subscriptionMonths ?? null;

  const existing = await db
    .select({ id: cartItems.id, qty: cartItems.qty })
    .from(cartItems)
    .where(
      and(
        eq(cartItems.cartId, cartId),
        eq(cartItems.productId, product.id),
        optionId === null ? sql`${cartItems.optionId} is null` : eq(cartItems.optionId, optionId),
        subscriptionMonths === null ? sql`${cartItems.subscriptionMonths} is null` : eq(cartItems.subscriptionMonths, subscriptionMonths),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db.update(cartItems).set({ qty: Math.min(99, existing[0].qty + qty) }).where(eq(cartItems.id, existing[0].id));
  } else {
    await db.insert(cartItems).values({ cartId, productId: product.id, optionId, qty, unitPriceCents: product.priceCents, subscriptionMonths });
  }
  await touch(cartId);
  return { cartId, itemCount: await countItems(cartId) };
}

export async function updateQty(session: Session, itemId: number, qty: number): Promise<void> {
  const cartId = await getCartId(session);
  if (!cartId) return;
  const db = getDb();
  if (qty <= 0) {
    await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));
  } else {
    await db.update(cartItems).set({ qty: Math.min(99, Math.trunc(qty)) }).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));
  }
  await touch(cartId);
}

export async function removeItem(session: Session, itemId: number): Promise<void> {
  return updateQty(session, itemId, 0);
}

export async function setSubscription(session: Session, itemId: number, months: number | null): Promise<void> {
  const cartId = await getCartId(session);
  if (!cartId) return;
  await getDb()
    .update(cartItems)
    .set({ subscriptionMonths: months })
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));
  await touch(cartId);
}

export async function countItems(cartId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`coalesce(sum(${cartItems.qty}), 0)` })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId));
  return row?.n ?? 0;
}

export async function getCartCount(session: Session): Promise<number> {
  const cartId = await getCartId(session);
  return cartId ? countItems(cartId) : 0;
}

export interface CartView {
  cartId: string | null;
  totals: CartTotals;
  lines: Array<CartLineInput & { slug: string; thumbUrl: string | null; stock: number; ignoreStock: boolean }>;
}

/** Cart lines joined with live product data, plus computed totals (no shipping/tax yet). */
export async function getCartView(session: Session): Promise<CartView> {
  const cartId = await getCartId(session);
  const threshold = Math.round(Number(env.FREE_SHIPPING_THRESHOLD ?? '99') * 100);
  if (!cartId) return { cartId: null, lines: [], totals: computeCartTotals([], { freeShippingThresholdCents: threshold }) };

  const rows = await getDb()
    .select({
      id: cartItems.id,
      productId: cartItems.productId,
      qty: cartItems.qty,
      unitPriceCents: cartItems.unitPriceCents,
      subscriptionMonths: cartItems.subscriptionMonths,
      isReward: cartItems.isReward,
      sku: products.sku,
      name: products.name,
      slug: products.slug,
      thumbUrl: products.thumbUrl,
      privateLabel: products.privateLabel,
      freeShipping: products.freeShipping,
      stock: products.stock,
      ignoreStock: products.ignoreStock,
      taxExempt: products.taxExempt,
      brandName: products.brandName,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(cartItems.id);

  const lines = rows.map((r) => ({
    ...r,
    isAirFilter: /air filter/i.test(r.name),
  }));

  const totals = computeCartTotals(lines, {
    freeShippingThresholdCents: threshold,
    subscriptionPromoActive: true,
    firstSubscriptionOrder: true,
  });
  return { cartId, lines, totals };
}

async function touch(cartId: string) {
  await getDb().update(carts).set({ updatedAt: sql`(current_timestamp)` }).where(eq(carts.id, cartId));
}
