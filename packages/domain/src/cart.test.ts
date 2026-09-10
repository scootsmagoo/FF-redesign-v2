import { computeCartTotals, roundUpDonationCents, type CartLineInput } from './cart';

const line = (over: Partial<CartLineInput> = {}): CartLineInput => ({
  id: 1,
  productId: 1,
  sku: 'X',
  name: 'Filter',
  qty: 1,
  unitPriceCents: 4000,
  subscriptionMonths: null,
  privateLabel: false,
  isAirFilter: false,
  freeShipping: false,
  isReward: false,
  ...over,
});

const opts = { freeShippingThresholdCents: 9900 };

describe('computeCartTotals', () => {
  it('sums lines and reports the free-shipping gap', () => {
    const t = computeCartTotals([line({ qty: 2 })], { ...opts, shippingCents: 795 });
    expect(t.subtotalCents).toBe(8000);
    expect(t.freeShippingEligible).toBe(false);
    expect(t.freeShippingGapCents).toBe(1900);
    expect(t.shippingCents).toBe(795);
    expect(t.totalCents).toBe(8795);
  });

  it('reports free-shipping eligibility at the threshold but still charges a chosen paid rate', () => {
    const free = computeCartTotals([line({ qty: 3 })], { ...opts, shippingCents: 0 });
    expect(free.freeShippingEligible).toBe(true);
    expect(free.freeShippingGapCents).toBe(0);
    expect(free.totalCents).toBe(12000);
    const upgraded = computeCartTotals([line({ qty: 3 })], { ...opts, shippingCents: 1495 });
    expect(upgraded.freeShippingEligible).toBe(true);
    expect(upgraded.shippingCents).toBe(1495);
    expect(upgraded.totalCents).toBe(13495);
  });

  it('applies the Home Filter Club discount and marks the cart free-shipping eligible', () => {
    const t = computeCartTotals([line({ subscriptionMonths: 6, privateLabel: true })], { ...opts, shippingCents: 0, subscriptionPromoActive: true, firstSubscriptionOrder: true });
    expect(t.lines[0]?.subscriptionDiscountPercent).toBe(20);
    expect(t.discountCents).toBe(800);
    expect(t.freeShippingEligible).toBe(true);
    expect(t.totalCents).toBe(3200);
  });

  it('never lets promo discounts push merchandise below zero', () => {
    const t = computeCartTotals([line()], { ...opts, promoDiscountCents: 99999 });
    expect(t.totalCents).toBe(0);
  });

  it('zero-prices reward lines', () => {
    const t = computeCartTotals([line(), line({ id: 2, isReward: true, unitPriceCents: 1500 })], opts);
    expect(t.subtotalCents).toBe(4000);
    expect(t.itemCount).toBe(2);
  });

  it('rounds up donations to the next dollar', () => {
    expect(roundUpDonationCents(8795)).toBe(5);
    expect(roundUpDonationCents(8800)).toBe(0);
  });
});
