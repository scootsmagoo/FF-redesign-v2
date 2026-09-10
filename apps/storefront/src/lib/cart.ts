import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { cartItems, carts, options, productOptionGroups, productOptions, products, quantityTiers } from '@ff/db';
import { computeCartTotals, type CartLineInput, type CartTotals } from '@ff/domain/cart';
import { tieredUnitPrice, type QuantityTier } from '@ff/domain/pricing';
import { applyPromotions, normalizeCode, rejectionMessage, type PromoLine, type PromotionRule } from '@ff/domain/promotions';
import { categoryIdsForProducts, MAX_CODES, resolveCode, resolveCodes } from './promotions';
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

/**
 * Validates an option against the product's (or its parent's) option groups and
 * returns the unit price with the option applied. Throws on a missing required option,
 * an option that doesn't belong, or an out-of-stock/excluded option.
 */
async function resolveOption(product: { id: number; parentProductId: number | null; priceCents: number }, optionId: number | null) {
  const db = getDb();
  const owner = product.parentProductId ?? product.id;
  const groups = await db
    .select({ groupId: productOptionGroups.groupId })
    .from(productOptionGroups)
    .where(eq(productOptionGroups.productId, owner));
  if (!groups.length) return { optionId: null, unitPriceCents: product.priceCents };

  if (!optionId) {
    const required = await db
      .select({ n: sql<number>`count(*)` })
      .from(productOptionGroups)
      .where(and(eq(productOptionGroups.productId, owner), sql`exists (select 1 from option_groups g where g.id = ${productOptionGroups.groupId} and g.required = 1)`));
    if ((required[0]?.n ?? 0) > 0) throw new Error('Please choose an option (size, pack, or type) before adding to cart');
    return { optionId: null, unitPriceCents: product.priceCents };
  }

  const opt = await db
    .select({ id: options.id, priceAddCents: options.priceAddCents, percentAdd: options.percentAdd })
    .from(options)
    .where(and(eq(options.id, optionId), inArray(options.groupId, groups.map((g) => g.groupId))))
    .limit(1);
  if (!opt[0]) throw new Error('That option is not available for this product');

  const po = await db
    .select({ stock: productOptions.stock, excluded: productOptions.excluded, priceOverrideCents: productOptions.priceOverrideCents })
    .from(productOptions)
    .where(and(eq(productOptions.optionId, optionId), or(eq(productOptions.productId, product.id), eq(productOptions.productId, owner))))
    .limit(1);
  if (po[0]?.excluded) throw new Error('That option is not available for this product');
  if (po[0]?.stock !== null && po[0]?.stock !== undefined && po[0].stock <= 0) throw new Error('That option is out of stock');

  const unit = po[0]?.priceOverrideCents ?? Math.round((product.priceCents + opt[0].priceAddCents) * (1 + opt[0].percentAdd / 100));
  return { optionId, unitPriceCents: unit };
}

export async function addItem(session: Session, input: AddItemInput): Promise<{ cartId: string; itemCount: number }> {
  const db = getDb();
  const product = await db.query.products.findFirst({
    columns: { id: true, priceCents: true, stock: true, ignoreStock: true, active: true, blockedReason: true, parentProductId: true, maxCartQty: true },
    where: eq(products.id, input.productId),
  });
  if (!product || !product.active || (product.blockedReason && product.blockedReason !== '')) throw new Error('Product not found');
  if (product.stock <= 0 && !product.ignoreStock) throw new Error('Product is out of stock');

  const { optionId, unitPriceCents } = await resolveOption(product, input.optionId ?? null);
  const cartId = await ensureCart(session);
  const maxQty = product.maxCartQty && product.maxCartQty > 0 ? product.maxCartQty : 99;
  const qty = Math.max(1, Math.min(maxQty, Math.trunc(input.qty)));
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
    await db.update(cartItems).set({ qty: Math.min(maxQty, existing[0].qty + qty), unitPriceCents }).where(eq(cartItems.id, existing[0].id));
  } else {
    await db.insert(cartItems).values({ cartId, productId: product.id, optionId, qty, unitPriceCents, subscriptionMonths });
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

export interface PromoSummary {
  codes: string[];
  applied: { code: string; label: string; discountCents: number; freeShipping: boolean }[];
  rejected: { code: string; message: string }[];
  discountCents: number;
  freeShipping: boolean;
}

export interface CartView {
  cartId: string | null;
  totals: CartTotals;
  lines: Array<CartLineInput & { slug: string; thumbUrl: string | null; stock: number; ignoreStock: boolean }>;
  promo: PromoSummary;
}

const EMPTY_PROMO: PromoSummary = { codes: [], applied: [], rejected: [], discountCents: 0, freeShipping: false };

async function getPromoCodes(cartId: string): Promise<string[]> {
  const row = await getDb().select({ promoCodes: carts.promoCodes }).from(carts).where(eq(carts.id, cartId)).limit(1);
  try {
    const list = JSON.parse(row[0]?.promoCodes ?? '[]') as unknown;
    return Array.isArray(list) ? list.filter((c): c is string => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

async function setPromoCodes(cartId: string, codes: string[]) {
  await getDb().update(carts).set({ promoCodes: JSON.stringify(codes) }).where(eq(carts.id, cartId));
}

/** Adds a code to the cart (creating the cart if needed). Returns a message for the UI. */
export async function applyPromo(session: Session, input: string): Promise<{ ok: boolean; message: string }> {
  const code = normalizeCode(input);
  if (!code) return { ok: false, message: 'Enter a promo code.' };
  const resolved = await resolveCode(code);
  if (!resolved.rule) return { ok: false, message: rejectionMessage('not-found') };
  const cartId = await ensureCart(session);
  const codes = await getPromoCodes(cartId);
  if (codes.includes(code)) return { ok: true, message: 'That code is already applied.' };
  if (codes.length >= MAX_CODES) return { ok: false, message: `You can apply up to ${MAX_CODES} codes.` };
  await setPromoCodes(cartId, [...codes, code]);
  await touch(cartId);
  const view = await getCartView(session);
  const hit = view.promo.applied.find((a) => a.code === code);
  if (hit) return { ok: true, message: `${hit.label} applied.` };
  const miss = view.promo.rejected.find((r) => r.code === code);
  return { ok: true, message: miss ? `Code saved. ${miss.message}` : 'Code saved.' };
}

export async function removePromo(session: Session, input: string): Promise<void> {
  const cartId = await getCartId(session);
  if (!cartId) return;
  const code = normalizeCode(input);
  await setPromoCodes(cartId, (await getPromoCodes(cartId)).filter((c) => c !== code));
  await touch(cartId);
}

/**
 * Cart lines joined with live product data. Unit prices are recomputed on every view:
 * current product price + option adjustment, then the quantity tier for the line's qty,
 * so a stale cart never carries an old price.
 */
export async function getCartView(session: Session): Promise<CartView> {
  const cartId = await getCartId(session);
  const threshold = Math.round(Number(env.FREE_SHIPPING_THRESHOLD ?? '99') * 100);
  if (!cartId) return { cartId: null, lines: [], totals: computeCartTotals([], { freeShippingThresholdCents: threshold }), promo: EMPTY_PROMO };

  const db = getDb();
  const rows = await db
    .select({
      id: cartItems.id,
      productId: cartItems.productId,
      qty: cartItems.qty,
      storedUnitCents: cartItems.unitPriceCents,
      optionId: cartItems.optionId,
      subscriptionMonths: cartItems.subscriptionMonths,
      isReward: cartItems.isReward,
      sku: products.sku,
      name: products.name,
      slug: products.slug,
      thumbUrl: products.thumbUrl,
      priceCents: products.priceCents,
      parentProductId: products.parentProductId,
      privateLabel: products.privateLabel,
      freeShipping: products.freeShipping,
      stock: products.stock,
      ignoreStock: products.ignoreStock,
      taxExempt: products.taxExempt,
      isHomeAirFilter: products.isHomeAirFilter,
      isFfAirFilter: products.isFfAirFilter,
      isFridgeFilter: products.isFridgeFilter,
      isFfWaterFilter: products.isFfWaterFilter,
      isHumidifierFilter: products.isHumidifierFilter,
      brandName: products.brandName,
      optionLabel: options.label,
      optionAddCents: options.priceAddCents,
      optionPct: options.percentAdd,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .leftJoin(options, eq(options.id, cartItems.optionId))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(cartItems.id);

  // Quantity tiers are keyed on the parent product for paired SKUs.
  const tierOwners = [...new Set(rows.map((r) => r.parentProductId ?? r.productId))];
  const tierRows = tierOwners.length
    ? await db
        .select({ productId: quantityTiers.productId, fromQty: quantityTiers.fromQty, toQty: quantityTiers.toQty, discountCents: quantityTiers.discountCents, discountPercent: quantityTiers.discountPercent })
        .from(quantityTiers)
        .where(and(inArray(quantityTiers.productId, tierOwners), sql`${quantityTiers.source} is null`))
    : [];
  const tiersByProduct = new Map<number, QuantityTier[]>();
  for (const t of tierRows) {
    const list = tiersByProduct.get(t.productId) ?? [];
    list.push({ fromQty: t.fromQty, toQty: t.toQty, discountCents: t.discountCents });
    tiersByProduct.set(t.productId, list);
  }

  const lines = rows.map((r) => {
    const base = Math.round((r.priceCents + (r.optionAddCents ?? 0)) * (1 + (r.optionPct ?? 0) / 100));
    const tiers = tiersByProduct.get(r.parentProductId ?? r.productId) ?? [];
    const unit = tieredUnitPrice(base, r.qty, tiers);
    return {
      id: r.id,
      productId: r.productId,
      sku: r.sku,
      name: r.name,
      slug: r.slug,
      thumbUrl: r.thumbUrl,
      qty: r.qty,
      unitPriceCents: unit,
      baseUnitCents: base,
      optionId: r.optionId,
      optionLabel: r.optionLabel,
      subscriptionMonths: r.subscriptionMonths,
      privateLabel: r.privateLabel,
      isAirFilter: r.isHomeAirFilter || r.isFfAirFilter || /air filter/i.test(r.name),
      freeShipping: r.freeShipping,
      isReward: r.isReward,
      taxExempt: r.taxExempt,
      stock: r.stock,
      ignoreStock: r.ignoreStock,
    };
  });

  // Promotions
  const codes = await getPromoCodes(cartId);
  let promo: PromoSummary = { ...EMPTY_PROMO, codes };
  if (codes.length && lines.length) {
    const resolved = await resolveCodes(codes);
    const catIds = await categoryIdsForProducts([...new Set(rows.map((r) => r.productId))]);
    const promoLines: PromoLine[] = rows.map((r, i) => ({
      productId: r.productId,
      qty: r.qty,
      unitPriceCents: lines[i]!.unitPriceCents,
      brandName: r.brandName,
      categoryIds: catIds.get(r.productId) ?? [],
      isFridgeFilter: r.isFridgeFilter,
      isHomeAirFilter: r.isHomeAirFilter,
      isFfWaterFilter: r.isFfWaterFilter,
      isHumidifierFilter: r.isHumidifierFilter,
      isReward: r.isReward,
    }));
    const rules: PromotionRule[] = [];
    const rejected: PromoSummary['rejected'] = [];
    for (const rc of resolved) {
      if (rc.rule) rules.push({ ...rc.rule, code: rc.code });
      else rejected.push({ code: rc.code, message: rejectionMessage('not-found') });
    }
    const today = new Date().toISOString().slice(0, 10);
    const result = applyPromotions(rules, promoLines, today);
    promo = {
      codes,
      applied: result.applied.map((a) => ({ code: a.rule.code ?? '', label: a.label, discountCents: a.discountCents, freeShipping: a.freeShipping })),
      rejected: [...rejected, ...result.rejected.map((r) => ({ code: r.rule.code ?? '', message: rejectionMessage(r.reason, r.rule) }))],
      discountCents: result.discountCents,
      freeShipping: result.freeShipping,
    };
  } else if (codes.length) {
    promo = { ...EMPTY_PROMO, codes, rejected: codes.map((code) => ({ code, message: 'Add items to your cart to use this code.' })) };
  }

  const totals = computeCartTotals(lines, {
    freeShippingThresholdCents: threshold,
    subscriptionPromoActive: true,
    firstSubscriptionOrder: true,
    promoDiscountCents: promo.discountCents,
    promoFreeShipping: promo.freeShipping,
  });
  return { cartId, lines, totals, promo };
}

async function touch(cartId: string) {
  await getDb().update(carts).set({ updatedAt: sql`(current_timestamp)` }).where(eq(carts.id, cartId));
}
