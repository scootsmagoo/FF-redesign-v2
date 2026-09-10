import { createProviders } from './index';
import type { Address } from './types';

const nc: Address = { firstName: 'A', lastName: 'B', line1: '1 Main St', city: 'Charlotte', region: 'NC', postalCode: '28201', country: 'US' };
const hi: Address = { ...nc, city: 'Honolulu', region: 'HI', postalCode: '96801' };
const poBox: Address = { ...nc, line1: 'PO Box 12' };

describe('createProviders', () => {
  const p = createProviders({ FREE_SHIPPING_THRESHOLD: '99' });

  it('defaults every provider to a stub', () => {
    expect(p.payment.name).toBe('stub');
    expect(p.tax.name).toBe('stub');
    expect(p.shipping.name).toBe('stub');
    expect(p.email.name).toBe('console');
    expect(p.address.name).toBe('passthrough');
  });

  it('rejects unknown provider names', () => {
    expect(() => createProviders({ PAYMENT_PROVIDER: 'stripe' })).toThrow(/Unknown provider/);
  });

  it('applies the free-shipping threshold to the contiguous US only', async () => {
    const items = [{ sku: 'X', qty: 1 }];
    const over = await p.shipping.getRates({ destination: nc, items, subtotalCents: 12000, freeShippingEligible: false });
    expect(over[0]?.priceCents).toBe(0);
    const under = await p.shipping.getRates({ destination: nc, items, subtotalCents: 5000, freeShippingEligible: false });
    expect(under[0]?.priceCents).toBe(795);
    const hawaii = await p.shipping.getRates({ destination: hi, items, subtotalCents: 12000, freeShippingEligible: false });
    expect(hawaii[0]?.priceCents).toBe(795);
    expect(hawaii[1]?.available).toBe(false);
  });

  it('blocks FedEx to PO boxes', async () => {
    const rates = await p.shipping.getRates({ destination: poBox, items: [{ sku: 'X', qty: 1 }], subtotalCents: 1000, freeShippingEligible: false });
    expect(rates.find((r) => r.id === 'fedex-2day')?.available).toBe(false);
    expect((await p.address.validate(poBox)).classification).toBe('po-box');
  });

  it('taxes NC and nothing else in the stub', async () => {
    const lines = [{ sku: 'X', qty: 2, unitPriceCents: 1000, discountCents: 0 }];
    expect((await p.tax.calculate({ destination: nc, lines, shippingCents: 0 })).taxCents).toBe(145);
    expect((await p.tax.calculate({ destination: hi, lines, shippingCents: 0 })).taxCents).toBe(0);
  });

  it('approves payments unless the token says decline', async () => {
    const base = { orderNumber: 'FF1', amountCents: 1000, currency: 'USD', method: 'card' as const, billing: nc, customerEmail: 'a@b.c' };
    expect((await p.payment.authorizeAndCapture({ ...base, token: 'tok_ok' })).ok).toBe(true);
    expect((await p.payment.authorizeAndCapture({ ...base, token: 'decline_1' })).ok).toBe(false);
  });
});
