import type { Cents } from './pricing';
import { subscriptionDiscountPercent } from './pricing';

/** A cart line after product data has been joined in. Pure data, no I/O. */
export interface CartLineInput {
  id: number;
  productId: number;
  sku: string;
  name: string;
  qty: number;
  unitPriceCents: Cents;
  /** Home Filter Club frequency in months; null = one-time */
  subscriptionMonths: number | null;
  privateLabel: boolean;
  isAirFilter: boolean;
  freeShipping: boolean;
  isReward: boolean;
  taxExempt?: boolean;
}

export interface CartLineTotals extends CartLineInput {
  /** unit price after subscription discount */
  effectiveUnitCents: Cents;
  subscriptionDiscountPercent: number;
  lineSubtotalCents: Cents;
  lineDiscountCents: Cents;
}

export interface CartTotals {
  lines: CartLineTotals[];
  itemCount: number;
  subtotalCents: Cents; // before discounts
  discountCents: Cents; // subscription + promo discounts
  promoDiscountCents: Cents;
  shippingCents: Cents;
  taxCents: Cents;
  donationCents: Cents;
  totalCents: Cents;
  /** cart qualifies for free economy shipping on its own (threshold, HFC, all-free items) */
  freeShippingEligible: boolean;
  /** how much more to spend to reach the free-shipping threshold, 0 when met */
  freeShippingGapCents: Cents;
}

export interface CartTotalsOptions {
  freeShippingThresholdCents: Cents;
  /** first Home Filter Club order for this customer (drives the 20% intro discount) */
  firstSubscriptionOrder?: boolean;
  subscriptionPromoActive?: boolean;
  promoDiscountCents?: Cents;
  promoFreeShipping?: boolean;
  shippingCents?: Cents;
  taxCents?: Cents;
  donationCents?: Cents;
}

/**
 * Computes cart totals. Promo-code evaluation (the legacy DiscOrder engine)
 * lives in promotions.ts and feeds its result in via `promoDiscountCents` /
 * `promoFreeShipping`; shipping and tax come from providers.
 */
export function computeCartTotals(input: CartLineInput[], opts: CartTotalsOptions): CartTotals {
  const lines: CartLineTotals[] = input.map((l) => {
    const pct = l.subscriptionMonths
      ? subscriptionDiscountPercent({
          privateLabel: l.privateLabel,
          isAirFilter: l.isAirFilter,
          firstOrder: opts.firstSubscriptionOrder ?? true,
          promoActive: opts.subscriptionPromoActive ?? false,
        })
      : 0;
    const unit = l.isReward ? 0 : l.unitPriceCents;
    const effective = Math.round(unit * (1 - pct / 100));
    return {
      ...l,
      effectiveUnitCents: effective,
      subscriptionDiscountPercent: pct,
      lineSubtotalCents: unit * l.qty,
      lineDiscountCents: (unit - effective) * l.qty,
    };
  });

  const subtotalCents = lines.reduce((s, l) => s + l.lineSubtotalCents, 0);
  const subscriptionDiscount = lines.reduce((s, l) => s + l.lineDiscountCents, 0);
  const promoDiscountCents = Math.min(opts.promoDiscountCents ?? 0, subtotalCents - subscriptionDiscount);
  const discountCents = subscriptionDiscount + promoDiscountCents;
  const merchandise = subtotalCents - discountCents;

  const hasSubscription = lines.some((l) => l.subscriptionMonths);
  const allFreeShip = lines.length > 0 && lines.every((l) => l.freeShipping || l.isReward);
  const meetsThreshold = merchandise >= opts.freeShippingThresholdCents;
  const freeShippingEligible = Boolean(opts.promoFreeShipping) || hasSubscription || allFreeShip || meetsThreshold;

  const shippingCents = freeShippingEligible && (opts.shippingCents ?? 0) > 0 ? 0 : (opts.shippingCents ?? 0);
  const taxCents = opts.taxCents ?? 0;
  const donationCents = opts.donationCents ?? 0;

  return {
    lines,
    itemCount: lines.reduce((s, l) => s + l.qty, 0),
    subtotalCents,
    discountCents,
    promoDiscountCents,
    shippingCents,
    taxCents,
    donationCents,
    totalCents: merchandise + shippingCents + taxCents + donationCents,
    freeShippingEligible,
    freeShippingGapCents: freeShippingEligible ? 0 : Math.max(0, opts.freeShippingThresholdCents - merchandise),
  };
}

/** Legacy "round up" donation: difference to the next whole dollar. */
export function roundUpDonationCents(totalCents: Cents): Cents {
  const rem = totalCents % 100;
  return rem === 0 ? 0 : 100 - rem;
}
