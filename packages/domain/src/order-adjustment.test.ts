import { computeAdjustment, recomputeOrderTotal } from './order-adjustment';

const order = { subtotalCents: 10000, discountCents: 1000, shippingCents: 795, taxCents: 705, donationCents: 100, totalCents: 10600, region: 'NC' };
const lines = [
  { id: 1, unitPriceCents: 5000, discountCents: 0, originalQty: 1, newQty: 1 },
  { id: 2, unitPriceCents: 2500, discountCents: 0, originalQty: 2, newQty: 2 },
];

describe('computeAdjustment', () => {
  it('reproduces the original order when nothing changes', () => {
    const r = computeAdjustment(order, lines);
    expect(r.subtotalCents).toBe(10000);
    expect(r.discountCents).toBe(1000);
    expect(r.taxCents).toBe(705);
    expect(r.totalCents).toBe(10600);
    expect(r.refundCents).toBe(0);
  });

  it('keeps the discount proportion and re-taxes at the effective rate when a line is reduced', () => {
    const r = computeAdjustment(order, [lines[0]!, { ...lines[1]!, newQty: 1 }]);
    expect(r.subtotalCents).toBe(7500);
    expect(r.discountCents).toBe(750);
    // effective rate = 705 / (10000 - 1000 + 795) = 0.072...
    expect(r.taxCents).toBe(Math.round((7500 - 750 + 795) * (705 / 9795)));
    expect(r.totalCents).toBe(7500 - 750 + 795 + r.taxCents + 100);
    expect(r.refundCents).toBe(10600 - r.totalCents);
  });

  it('does not tax shipping in exempt states', () => {
    const r = computeAdjustment({ ...order, region: 'CA' }, lines);
    expect(r.effectiveTaxRate).toBeCloseTo(705 / 9000, 6);
  });

  it('refunds everything when every line is removed and never exceeds the original quantity', () => {
    const r = computeAdjustment(order, lines.map((l) => ({ ...l, newQty: 0 })));
    expect(r.totalCents).toBe(0);
    expect(r.refundCents).toBe(10600);
    const over = computeAdjustment(order, lines.map((l) => ({ ...l, newQty: 99 })));
    expect(over.subtotalCents).toBe(10000);
  });

  it('recomputes a manual total with the legacy rule', () => {
    expect(recomputeOrderTotal({ subtotalCents: 10000, discountCents: 500, shippingCents: 795, taxCents: 600, donationCents: 0, adjustmentCents: -200 })).toBe(10695);
  });
});
