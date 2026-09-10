/**
 * Order-level promotion engine, ported from the legacy DiscOrder rules
 * (docs/legacy-inventory/01-customer-features.md §6). Pure: no I/O.
 *
 * Supported: percent / amount off, subtotal window (with the legacy $0.11 tolerance),
 * date window, free shipping, scope by product / category / product class / brand /
 * id list, multiply-by-qty, tiered sale thresholds, exclusive vs compoundable stacking.
 * Not yet: gift-with-purchase, BOGO, presence requirements (reported as `unsupported`).
 */
import type { Cents } from './pricing';

export interface PromotionRule {
  id: number;
  code: string | null;
  tag: string | null;
  title: string | null;
  status: 'active' | 'inactive' | string;
  percentOff: number | null;
  amountOffCents: Cents | null;
  minSubtotalCents: Cents | null;
  maxSubtotalCents: Cents | null;
  validFrom: string | null; // YYYY-MM-DD
  validTo: string | null;
  onceOnly: boolean;
  freeShipping: boolean;
  exclusive: boolean;
  compoundable: boolean;
  /** 0 global, 1 product-driven, 2 category-driven */
  scopeKind: number;
  /** id, or a negative class sentinel: -9 humidifier, -8 home air, -7 FF water, -6 fridge, -5 brand (matchValue), -4 id list (matchValue) */
  scopeRef: number | null;
  matchValue: string | null;
  giftWithPurchase: boolean;
  bogo: boolean;
  tiered: boolean;
  /** raw legacy row for fields not modelled as columns */
  legacy?: Record<string, unknown>;
}

export interface PromoLine {
  productId: number;
  qty: number;
  /** unit price after option/tier, before promotions */
  unitPriceCents: Cents;
  brandName?: string | null;
  categoryIds?: number[]; // includes parent categories
  isFridgeFilter?: boolean;
  isHomeAirFilter?: boolean;
  isFfWaterFilter?: boolean;
  isHumidifierFilter?: boolean;
  isReward?: boolean;
  /** source-priced or Google auto-discount lines suppress all promos (legacy preventPromo) */
  blocksPromo?: boolean;
}

export type PromoRejection =
  | 'not-found'
  | 'inactive'
  | 'expired'
  | 'not-started'
  | 'below-minimum'
  | 'above-maximum'
  | 'no-eligible-items'
  | 'unsupported'
  | 'not-stackable'
  | 'blocked';

export interface PromoEvaluation {
  ok: boolean;
  rule: PromotionRule;
  discountCents: Cents;
  freeShipping: boolean;
  reason?: PromoRejection;
  /** human-readable label for the cart ("10% off refrigerator filters") */
  label: string;
}

const TOLERANCE = 11; // legacy compares subtotal windows with an 11-cent slack

function eligibleLines(rule: PromotionRule, lines: PromoLine[]): PromoLine[] {
  const usable = lines.filter((l) => !l.isReward);
  const ref = rule.scopeRef ?? 0;
  if (rule.scopeKind === 2 && ref > 0) return usable.filter((l) => l.categoryIds?.includes(ref));
  if (rule.scopeKind === 1 && ref > 0) return usable.filter((l) => l.productId === ref);
  switch (ref) {
    case -9: return usable.filter((l) => l.isHumidifierFilter);
    case -8: return usable.filter((l) => l.isHomeAirFilter);
    case -7: return usable.filter((l) => l.isFfWaterFilter);
    case -6: return usable.filter((l) => l.isFridgeFilter);
    case -5: {
      const brand = (rule.matchValue ?? '').trim().toLowerCase();
      return brand ? usable.filter((l) => (l.brandName ?? '').trim().toLowerCase() === brand) : [];
    }
    case -4: {
      const ids = new Set((rule.matchValue ?? '').split(/[,\s;|]+/).map((s) => Number.parseInt(s, 10)).filter((n) => Number.isFinite(n)));
      return ids.size ? usable.filter((l) => ids.has(l.productId)) : [];
    }
    default:
      return ref > 0 && rule.scopeKind === 0 ? usable.filter((l) => l.productId === ref) : usable;
  }
}

function describe(rule: PromotionRule): string {
  if (rule.title) return rule.title;
  if (rule.percentOff) return `${rule.percentOff}% off`;
  if (rule.amountOffCents) return `$${(rule.amountOffCents / 100).toFixed(2)} off`;
  if (rule.freeShipping) return 'Free shipping';
  return rule.code ?? 'Promotion';
}

/** Evaluates one promotion against the cart. `today` is YYYY-MM-DD (UTC). */
export function evaluatePromotion(rule: PromotionRule, lines: PromoLine[], today: string): PromoEvaluation {
  const base: PromoEvaluation = { ok: false, rule, discountCents: 0, freeShipping: false, label: describe(rule) };
  if (rule.status !== 'active') return { ...base, reason: 'inactive' };
  if (rule.validFrom && today < rule.validFrom) return { ...base, reason: 'not-started' };
  if (rule.validTo && today > rule.validTo) return { ...base, reason: 'expired' };
  if (rule.giftWithPurchase || rule.bogo) return { ...base, reason: 'unsupported' };
  if (lines.some((l) => l.blocksPromo)) return { ...base, reason: 'blocked' };

  const cartSubtotal = lines.filter((l) => !l.isReward).reduce((s, l) => s + l.unitPriceCents * l.qty, 0);
  if (rule.minSubtotalCents && cartSubtotal + TOLERANCE < rule.minSubtotalCents) return { ...base, reason: 'below-minimum' };
  if (rule.maxSubtotalCents && rule.maxSubtotalCents > 0 && cartSubtotal - TOLERANCE > rule.maxSubtotalCents) return { ...base, reason: 'above-maximum' };

  const eligible = eligibleLines(rule, lines);
  if (!eligible.length) return { ...base, reason: 'no-eligible-items' };
  const eligibleSubtotal = eligible.reduce((s, l) => s + l.unitPriceCents * l.qty, 0);
  const eligibleQty = eligible.reduce((s, l) => s + l.qty, 0);

  let discount = 0;
  if (rule.tiered && rule.legacy) {
    for (let i = 4; i >= 1; i--) {
      const th = Number(rule.legacy[`tieredThresh${i}`] ?? 0) * 100;
      const amt = Number(rule.legacy[`tieredDiscAmt${i}`] ?? 0) * 100;
      if (th > 0 && cartSubtotal + TOLERANCE >= th) {
        discount = Math.round(amt);
        break;
      }
    }
  } else if (rule.percentOff) {
    discount = Math.round(eligibleSubtotal * (rule.percentOff / 100));
  } else if (rule.amountOffCents) {
    const multiply = Boolean(rule.legacy?.discMultiByQty) && Number(rule.legacy?.discMultiByQty) !== 0;
    discount = multiply ? rule.amountOffCents * eligibleQty : rule.amountOffCents;
  }
  discount = Math.min(discount, eligibleSubtotal);

  if (discount <= 0 && !rule.freeShipping) return { ...base, reason: 'no-eligible-items' };
  return { ...base, ok: true, discountCents: discount, freeShipping: rule.freeShipping };
}

export interface PromoStackResult {
  applied: PromoEvaluation[];
  rejected: PromoEvaluation[];
  discountCents: Cents;
  freeShipping: boolean;
}

/**
 * Applies codes in order. An `exclusive` promotion stands alone; non-compoundable
 * promotions don't stack with each other; compoundable ones stack. Discounts never exceed
 * the cart subtotal.
 */
export function applyPromotions(rules: PromotionRule[], lines: PromoLine[], today: string): PromoStackResult {
  const applied: PromoEvaluation[] = [];
  const rejected: PromoEvaluation[] = [];
  const subtotal = lines.filter((l) => !l.isReward).reduce((s, l) => s + l.unitPriceCents * l.qty, 0);
  for (const rule of rules) {
    const ev = evaluatePromotion(rule, lines, today);
    if (!ev.ok) {
      rejected.push(ev);
      continue;
    }
    // A promotion stacks only when it and everything already applied are compoundable and nothing is exclusive.
    const anyExclusive = applied.some((a) => a.rule.exclusive);
    const stackable = applied.length === 0 || (!anyExclusive && !rule.exclusive && rule.compoundable && applied.every((a) => a.rule.compoundable));
    if (!stackable) {
      rejected.push({ ...ev, ok: false, reason: 'not-stackable' });
      continue;
    }
    applied.push(ev);
  }
  const discountCents = Math.min(subtotal, applied.reduce((s, a) => s + a.discountCents, 0));
  return { applied, rejected, discountCents, freeShipping: applied.some((a) => a.freeShipping) };
}

export function rejectionMessage(reason: PromoRejection | undefined, rule?: PromotionRule): string {
  switch (reason) {
    case 'not-found': return 'That code is not valid.';
    case 'inactive': return 'That code is no longer active.';
    case 'expired': return 'That code has expired.';
    case 'not-started': return 'That code is not active yet.';
    case 'below-minimum': return rule?.minSubtotalCents ? `Add $${(rule.minSubtotalCents / 100).toFixed(2)} or more of eligible items to use this code.` : 'Your order does not meet the minimum for this code.';
    case 'above-maximum': return 'Your order is above the maximum for this code.';
    case 'no-eligible-items': return 'This code does not apply to the items in your cart.';
    case 'unsupported': return 'This promotion cannot be applied online yet. Call (866) 438-3458 and we will apply it for you.';
    case 'not-stackable': return 'This code cannot be combined with the promotion already applied.';
    case 'blocked': return 'Promotions cannot be combined with the special pricing already in your cart.';
    default: return 'That code could not be applied.';
  }
}

/** Normalise user input the way the legacy site did: trim, upper-case, strip spaces. */
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}
