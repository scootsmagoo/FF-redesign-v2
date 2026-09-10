import {
  asLowAsPrice,
  formatMoney,
  perEachPrice,
  savingsPercent,
  subscriptionDiscountPercent,
  tieredUnitPrice,
  toCents,
} from './pricing';

describe('pricing', () => {
  it('converts decimals to cents safely', () => {
    expect(toCents('19.99')).toBe(1999);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents('abc')).toBe(0);
  });

  it('formats money', () => {
    expect(formatMoney(1999)).toBe('$19.99');
    expect(formatMoney(1999, 'CAD', 'en-CA')).toBe('$19.99');
  });

  it('computes savings percent like the legacy PDP', () => {
    expect(savingsPercent(4999, 3499)).toBe(30);
    expect(savingsPercent(4999, 4999)).toBeNull();
    expect(savingsPercent(0, 100)).toBeNull();
  });

  it('computes per-each and tier pricing', () => {
    expect(perEachPrice(6000, 6)).toBe(1000);
    const tiers = [
      { fromQty: 3, toQty: 5, discountCents: 100 },
      { fromQty: 6, toQty: null, discountCents: 250 },
    ];
    expect(tieredUnitPrice(2000, 1, tiers)).toBe(2000);
    expect(tieredUnitPrice(2000, 4, tiers)).toBe(1900);
    expect(tieredUnitPrice(2000, 12, tiers)).toBe(1750);
    expect(asLowAsPrice(2000, tiers)).toBe(1750);
  });

  it('applies the Home Filter Club ladder', () => {
    expect(subscriptionDiscountPercent({ privateLabel: false, isAirFilter: false, firstOrder: true, promoActive: true })).toBe(5);
    expect(subscriptionDiscountPercent({ privateLabel: true, isAirFilter: true, firstOrder: true, promoActive: true })).toBe(10);
    expect(subscriptionDiscountPercent({ privateLabel: true, isAirFilter: false, firstOrder: true, promoActive: true })).toBe(20);
    expect(subscriptionDiscountPercent({ privateLabel: true, isAirFilter: false, firstOrder: false, promoActive: true })).toBe(10);
  });
});
