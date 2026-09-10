import type { TaxProvider, TaxRequest, TaxResult } from '../types';

/**
 * Nexus-table tax: applies a flat combined rate for the states listed and 0
 * elsewhere. Filters Fast is in Charlotte, NC; the real nexus list and rates
 * come from TaxJar, which replaces this behind the same interface.
 */
export class StubTaxProvider implements TaxProvider {
  readonly name = 'stub';
  constructor(private readonly rates: Record<string, number> = { NC: 0.0725 }, private readonly taxShipping = false) {}

  async calculate(req: TaxRequest): Promise<TaxResult> {
    if (req.destination.country !== 'US') return { taxCents: 0, rate: 0 };
    const rate = this.rates[req.destination.region.toUpperCase()] ?? 0;
    if (!rate) return { taxCents: 0, rate: 0 };
    const taxable = req.lines.reduce((sum, l) => (l.taxExempt ? sum : sum + l.unitPriceCents * l.qty - l.discountCents), 0);
    const base = taxable + (this.taxShipping ? req.shippingCents : 0);
    return { taxCents: Math.round(base * rate), rate, detail: { provider: 'stub', base } };
  }
}
