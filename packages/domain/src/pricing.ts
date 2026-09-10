/**
 * Money is handled in integer cents everywhere in v2. Legacy stored decimals;
 * the import layer converts once.
 */

export type Cents = number;

export function toCents(decimal: number | string): Cents {
  const n = typeof decimal === 'string' ? Number.parseFloat(decimal) : decimal;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function formatMoney(cents: Cents, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

/**
 * Legacy rule (prodViewHv2.asp): "You Save: NN%" is the rounded whole percent
 * of (list - price) / list, only shown when list > price.
 */
export function savingsPercent(listCents: Cents, priceCents: Cents): number | null {
  if (listCents <= 0 || priceCents >= listCents) return null;
  return Math.round(((listCents - priceCents) / listCents) * 100);
}

/** Per-each price for multi-packs ("Only $X per filter"). */
export function perEachPrice(priceCents: Cents, packQty: number): Cents {
  if (packQty <= 1) return priceCents;
  return Math.round(priceCents / packQty);
}

export interface QuantityTier {
  fromQty: number;
  toQty: number | null; // null = open-ended ("6+")
  /** Absolute discount per unit, in cents. */
  discountCents: Cents;
}

/** Applies the best matching quantity tier (legacy DiscProd) to a unit price. */
export function tieredUnitPrice(priceCents: Cents, qty: number, tiers: QuantityTier[]): Cents {
  const tier = tiers.find((t) => qty >= t.fromQty && (t.toQty === null || qty <= t.toQty));
  return tier ? Math.max(0, priceCents - tier.discountCents) : priceCents;
}

/** "As low as" price = unit price minus the deepest tier discount. */
export function asLowAsPrice(priceCents: Cents, tiers: QuantityTier[]): Cents {
  const max = tiers.reduce((m, t) => Math.max(m, t.discountCents), 0);
  return Math.max(0, priceCents - max);
}

/**
 * Home Filter Club discount ladder (prodViewHv2.asp getSubDisc), as of Sept 2026:
 *  - Filters Fast / PureH2O private-label, non-air: 20% first order during promo, else 10%
 *  - other private-label: 10%
 *  - everything else: 5%
 */
export function subscriptionDiscountPercent(opts: {
  privateLabel: boolean;
  isAirFilter: boolean;
  firstOrder: boolean;
  promoActive: boolean;
}): number {
  if (!opts.privateLabel) return 5;
  if (!opts.isAirFilter && opts.firstOrder && opts.promoActive) return 20;
  return 10;
}
