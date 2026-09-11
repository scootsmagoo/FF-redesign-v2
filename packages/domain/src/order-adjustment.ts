import type { Cents } from './pricing';

/**
 * Order adjustment / refund calculator (legacy Manager/order_adjustment.asp): given the original
 * order and reduced line quantities, what should the new total be and how much is refundable.
 * Discounts are kept at their original proportion of the subtotal; tax is recomputed at the
 * order's effective rate (shipping untaxed in the states that exempt it); a fully emptied order
 * refunds everything.
 */

/** States where shipping charges are not taxed (legacy list). */
export const SHIPPING_UNTAXED_REGIONS = new Set(['AL', 'AZ', 'CA', 'CO', 'ID', 'IA', 'LA', 'ME', 'MD', 'MA', 'MO', 'NV', 'OK', 'UT', 'VA', 'WY']);

export interface AdjustLine {
  id: number;
  unitPriceCents: Cents;
  discountCents: Cents;
  originalQty: number;
  newQty: number;
}

export interface AdjustOrder {
  subtotalCents: Cents; // before discounts
  discountCents: Cents;
  shippingCents: Cents;
  taxCents: Cents;
  donationCents: Cents;
  totalCents: Cents;
  /** shipping region code (state) used for the shipping-tax rule */
  region: string;
}

export interface AdjustResult {
  subtotalCents: Cents;
  discountCents: Cents;
  shippingCents: Cents;
  taxCents: Cents;
  donationCents: Cents;
  totalCents: Cents;
  refundCents: Cents;
  effectiveTaxRate: number;
}

export function computeAdjustment(order: AdjustOrder, lines: AdjustLine[]): AdjustResult {
  const clamp = (l: AdjustLine) => Math.max(0, Math.min(l.originalQty, Math.trunc(l.newQty)));
  const subtotalCents = lines.reduce((s, l) => s + (l.unitPriceCents - l.discountCents) * clamp(l), 0);
  const totalQty = lines.reduce((s, l) => s + clamp(l), 0);
  if (totalQty === 0) {
    return { subtotalCents: 0, discountCents: 0, shippingCents: 0, taxCents: 0, donationCents: 0, totalCents: 0, refundCents: order.totalCents, effectiveTaxRate: 0 };
  }
  const discountRatio = order.subtotalCents > 0 ? order.discountCents / order.subtotalCents : 0;
  const discountCents = Math.round(subtotalCents * discountRatio);
  const shippingCents = order.shippingCents;
  const taxableOriginal = order.subtotalCents - order.discountCents + (SHIPPING_UNTAXED_REGIONS.has(order.region.toUpperCase()) ? 0 : order.shippingCents);
  const effectiveTaxRate = order.taxCents > 0 && taxableOriginal > 0 ? order.taxCents / taxableOriginal : 0;
  const taxableNew = subtotalCents - discountCents + (SHIPPING_UNTAXED_REGIONS.has(order.region.toUpperCase()) ? 0 : shippingCents);
  const taxCents = Math.round(taxableNew * effectiveTaxRate);
  const donationCents = order.donationCents;
  const totalCents = subtotalCents - discountCents + shippingCents + taxCents + donationCents;
  return { subtotalCents, discountCents, shippingCents, taxCents, donationCents, totalCents, refundCents: Math.max(0, order.totalCents - totalCents), effectiveTaxRate };
}

/** Legacy total rule for manual order edits: subtotal − discount + shipping + handling + tax + adjustment + donation + fees. */
export function recomputeOrderTotal(parts: { subtotalCents: Cents; discountCents: Cents; shippingCents: Cents; taxCents: Cents; donationCents: Cents; adjustmentCents?: Cents }): Cents {
  return parts.subtotalCents - parts.discountCents + parts.shippingCents + parts.taxCents + parts.donationCents + (parts.adjustmentCents ?? 0);
}

/** Legacy credit reason codes (order_credits.reasonCredit). */
export const CREDIT_REASONS = [
  'BAGDAMAGE',
  'CHARGEBACK',
  'CODB',
  'CS ERROR',
  ...Array.from({ length: 15 }, (_, i) => `CUSTERR${String(i + 1).padStart(2, '0')}`),
  'DAMAGED',
  'DEFECTIVE',
  'INCPAIR',
  'LOST',
  'MGREXC',
  'NODISCOUNT',
  'NOTCOMP',
  'OTDERR01',
  'OTDERR02',
  'OTDERR03',
  'OTDERR04',
  'OVERSTOCK',
  'PKGINITNS',
  'PUR ERROR',
  'RESTOCK',
  'RET-NOSET',
  ...Array.from({ length: 7 }, (_, i) => `UNDELIVER${i + 1}`),
  'VENDERR',
  'VENDRESHIP',
  ...Array.from({ length: 6 }, (_, i) => `WAR ERROR${i + 1}`),
  'WEB ERROR',
  'WEB1',
  'WEB2',
  'WEB3',
];

/** Legacy ReasonCancelled codes. */
export const CANCEL_REASONS: Record<number, string> = { 1: 'Buyer cancelled', 2: 'Merchant cancelled', 3: 'Duplicate / invalid', 4: 'Fraud / fake' };
