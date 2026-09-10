import { applyPromotions, evaluatePromotion, normalizeCode, type PromoLine, type PromotionRule } from './promotions';

const rule = (over: Partial<PromotionRule> = {}): PromotionRule => ({
  id: 1, code: 'TEST', tag: 'T', title: null, status: 'active', percentOff: null, amountOffCents: null, minSubtotalCents: null, maxSubtotalCents: null,
  validFrom: null, validTo: null, onceOnly: false, freeShipping: false, exclusive: false, compoundable: false, scopeKind: 0, scopeRef: 0,
  matchValue: null, giftWithPurchase: false, bogo: false, tiered: false, ...over,
});
const line = (over: Partial<PromoLine> = {}): PromoLine => ({ productId: 1, qty: 1, unitPriceCents: 5000, brandName: 'GE', categoryIds: [25, 1], isFridgeFilter: true, ...over });
const TODAY = '2026-09-10';

describe('evaluatePromotion', () => {
  it('applies a percent off the whole cart', () => {
    const ev = evaluatePromotion(rule({ percentOff: 10 }), [line(), line({ productId: 2, qty: 2, unitPriceCents: 1000, isFridgeFilter: false })], TODAY);
    expect(ev.ok).toBe(true);
    expect(ev.discountCents).toBe(700);
  });

  it('honours date and subtotal windows with the legacy tolerance', () => {
    expect(evaluatePromotion(rule({ percentOff: 10, validTo: '2026-09-09' }), [line()], TODAY).reason).toBe('expired');
    expect(evaluatePromotion(rule({ percentOff: 10, validFrom: '2026-09-11' }), [line()], TODAY).reason).toBe('not-started');
    expect(evaluatePromotion(rule({ percentOff: 10, minSubtotalCents: 5010 }), [line()], TODAY).ok).toBe(true);
    expect(evaluatePromotion(rule({ percentOff: 10, minSubtotalCents: 5012 }), [line()], TODAY).reason).toBe('below-minimum');
    expect(evaluatePromotion(rule({ percentOff: 10, maxSubtotalCents: 4000 }), [line()], TODAY).reason).toBe('above-maximum');
  });

  it('scopes by product class, brand, category, product and id list', () => {
    const lines = [line(), line({ productId: 2, unitPriceCents: 2000, brandName: 'Honeywell', categoryIds: [64], isFridgeFilter: false, isHomeAirFilter: true })];
    expect(evaluatePromotion(rule({ percentOff: 50, scopeRef: -6 }), lines, TODAY).discountCents).toBe(2500);
    expect(evaluatePromotion(rule({ percentOff: 50, scopeRef: -8 }), lines, TODAY).discountCents).toBe(1000);
    expect(evaluatePromotion(rule({ percentOff: 50, scopeRef: -5, matchValue: 'honeywell' }), lines, TODAY).discountCents).toBe(1000);
    expect(evaluatePromotion(rule({ percentOff: 50, scopeKind: 2, scopeRef: 64 }), lines, TODAY).discountCents).toBe(1000);
    expect(evaluatePromotion(rule({ percentOff: 50, scopeKind: 1, scopeRef: 1 }), lines, TODAY).discountCents).toBe(2500);
    expect(evaluatePromotion(rule({ percentOff: 50, scopeRef: -4, matchValue: '2, 99' }), lines, TODAY).discountCents).toBe(1000);
    expect(evaluatePromotion(rule({ percentOff: 50, scopeRef: -9 }), lines, TODAY).reason).toBe('no-eligible-items');
  });

  it('caps amount-off at the eligible subtotal and multiplies by qty when flagged', () => {
    expect(evaluatePromotion(rule({ amountOffCents: 9999 }), [line({ unitPriceCents: 1000 })], TODAY).discountCents).toBe(1000);
    expect(evaluatePromotion(rule({ amountOffCents: 500, legacy: { discMultiByQty: 1 } }), [line({ qty: 3 })], TODAY).discountCents).toBe(1500);
  });

  it('uses the highest tier reached for tiered sales', () => {
    const r = rule({ tiered: true, legacy: { tieredThresh1: 50, tieredDiscAmt1: 5, tieredThresh2: 100, tieredDiscAmt2: 15, tieredThresh3: 0, tieredThresh4: 0 } });
    expect(evaluatePromotion(r, [line({ qty: 1 })], TODAY).discountCents).toBe(500);
    expect(evaluatePromotion(r, [line({ qty: 2 })], TODAY).discountCents).toBe(1500);
  });

  it('flags unsupported and blocked promotions', () => {
    expect(evaluatePromotion(rule({ bogo: true }), [line()], TODAY).reason).toBe('unsupported');
    expect(evaluatePromotion(rule({ percentOff: 10 }), [line({ blocksPromo: true })], TODAY).reason).toBe('blocked');
    expect(evaluatePromotion(rule({ freeShipping: true }), [line()], TODAY)).toMatchObject({ ok: true, discountCents: 0, freeShipping: true });
  });
});

describe('applyPromotions', () => {
  it('stacks only compoundable promotions and respects exclusive ones', () => {
    const lines = [line({ unitPriceCents: 10000 })];
    const a = rule({ id: 1, code: 'A', percentOff: 10, compoundable: true });
    const b = rule({ id: 2, code: 'B', amountOffCents: 500, compoundable: true });
    const c = rule({ id: 3, code: 'C', percentOff: 5 });
    const x = rule({ id: 4, code: 'X', percentOff: 20, exclusive: true });
    expect(applyPromotions([a, b], lines, TODAY).discountCents).toBe(1500);
    const r = applyPromotions([a, c], lines, TODAY);
    expect(r.applied.map((p) => p.rule.code)).toEqual(['A']);
    expect(r.rejected[0]?.reason).toBe('not-stackable');
    expect(applyPromotions([x, a], lines, TODAY).applied.map((p) => p.rule.code)).toEqual(['X']);
    expect(applyPromotions([a, x], lines, TODAY).applied.map((p) => p.rule.code)).toEqual(['A']);
  });

  it('normalises codes', () => {
    expect(normalizeCode('  save 10 ')).toBe('SAVE10');
  });
});
