import { formatAddressLines, formatEmailDate, normalizeCarrier, orderStatusUrl, renderOrderConfirmation, renderPasswordReset, renderShipmentNotice, trackingUrl, type OrderEmailData } from './emails';

const order: OrderEmailData = {
  siteUrl: 'https://www.filtersfast.com',
  number: 'FFTEST123',
  email: 'jo@example.com',
  placedAt: '2026-09-11 14:03:00',
  shipTo: { firstName: 'Jo', lastName: "O'Brien", line1: '1 Main St', city: 'Monroe', region: 'NC', postalCode: '28110', country: 'US' },
  shippingMethod: 'Economy (3-7 business days)',
  lines: [
    { sku: '20x25x1M8', name: '20x25x1 Air Filter MERV 8 <Filters Fast> 6-Pack', qty: 2, unitPriceCents: 4995, discountCents: 500 },
    { sku: 'EDR4RXD1', name: 'Whirlpool EDR4RXD1 everydrop Filter 4', optionLabel: '2-Pack', qty: 1, unitPriceCents: 8999, subscriptionMonths: 6 },
  ],
  subtotalCents: 18989,
  discountCents: 500,
  shippingCents: 0,
  taxCents: 1201,
  donationCents: 100,
  totalCents: 19791,
  promoCodes: ['SAVE5'],
};

describe('order confirmation', () => {
  const r = renderOrderConfirmation(order);

  it('has the brand subject and greets by first name', () => {
    expect(r.subject).toBe('Your FiltersFast.com order FFTEST123');
    expect(r.html).toContain('Hi Jo, we received order <strong>FFTEST123</strong> on September 11, 2026');
    expect(r.text).toContain('Thanks for your order, Jo!');
  });

  it('escapes HTML in product names and addresses', () => {
    expect(r.html).toContain('&lt;Filters Fast&gt;');
    expect(r.html).not.toContain('<Filters Fast>');
    expect(r.html).toContain('O&#39;Brien');
  });

  it('shows totals, the promo code, FREE shipping and the donation', () => {
    expect(r.html).toContain('Discounts (SAVE5)');
    expect(r.html).toContain('-$5.00');
    expect(r.html).toContain('FREE');
    expect(r.html).toContain('Donation');
    expect(r.html).toContain('$197.91');
    expect(r.text).toContain('Total: $197.91');
  });

  it('links the guest-safe order page and the logo on the site origin', () => {
    expect(r.html).toContain('https://www.filtersfast.com/track-order?number=FFTEST123&amp;email=jo%40example.com');
    expect(r.html).toContain('https://www.filtersfast.com/brand/FF-shield-logo.png');
    expect(r.text).toContain('https://www.filtersfast.com/track-order?number=FFTEST123&email=jo%40example.com');
  });

  it('mentions Home Filter Club for subscription lines and never "Auto delivery"', () => {
    expect(r.html).toContain('Home Filter Club &middot; every 6 months');
    expect(r.html.toLowerCase()).not.toContain('auto delivery');
  });

  it('produces the legacy SendGrid substitution set', () => {
    expect(r.templateData).toMatchObject({
      firstname: 'Jo',
      ordernumber: 'FFTEST123',
      ordertotal: '$197.91',
      orderDiscount: '$5.00',
      orderShipping: '$0.00',
      orderHandling: '$0.00',
      DonationAmount: '$1.00',
      orderTax: '$12.01',
    });
    const items = (r.templateData.order as { items: Record<string, string>[] }).items;
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ sku: '20x25x1M8', quantity: '2', description: '20x25x1 Air Filter MERV 8 <Filters Fast> 6-Pack', eachPrice: '$49.95', linePrice: '$94.90' });
    expect(items[1]?.description).toBe('Whirlpool EDR4RXD1 everydrop Filter 4 (2-Pack)');
  });

  it('falls back to "there" without a first name', () => {
    const r2 = renderOrderConfirmation({ ...order, shipTo: { ...order.shipTo, firstName: '' } });
    expect(r2.html).toContain('Hi there,');
  });
});

describe('shipment notice', () => {
  it('links the carrier tracking page and includes the legacy fields', () => {
    const r = renderShipmentNotice({ ...order, carrier: 'UPS', trackingNumber: '1Z999AA10123456784', shippedAt: '2026-09-12T10:00:00Z' });
    expect(r.subject).toBe('Your FiltersFast.com order FFTEST123 has shipped');
    expect(r.html).toContain('https://www.ups.com/track?tracknum=1Z999AA10123456784');
    expect(r.html).toContain('Track Your Package');
    expect(r.html).toContain('shipped on September 12, 2026 via UPS');
    expect(r.text).toContain('Track it: https://www.ups.com/track?tracknum=1Z999AA10123456784');
    expect(r.templateData).toMatchObject({ shipped: true, shippingMethod: 'UPS', trackingNumberPlain: '1Z999AA10123456784' });
    expect(r.templateData.shippingNameAndAddress).toBe('Jo O&#39;Brien<br>1 Main St<br>Monroe, NC 28110');
    expect(String(r.templateData.trackingNumber)).toMatch(/^<a href="https:\/\/www\.ups\.com/);
  });

  it('falls back to the order link when the carrier is unknown', () => {
    const r = renderShipmentNotice({ ...order, carrier: 'Other', trackingNumber: 'ABC-1' });
    expect(r.html).not.toContain('Track Your Package');
    expect(r.html).toContain('View Your Order');
    expect(r.html).toContain('Tracking number: <strong>ABC-1</strong>');
    expect(r.templateData.trackingUrl).toBe('');
  });
});

describe('password reset', () => {
  it('renders the link, the expiry and a plain-text copy', () => {
    const r = renderPasswordReset({ siteUrl: 'https://www.filtersfast.com', name: 'Jo', url: 'https://www.filtersfast.com/account/reset-password?token=abc&x=1' });
    expect(r.subject).toBe('Reset your FiltersFast.com password');
    expect(r.html).toContain('href="https://www.filtersfast.com/account/reset-password?token=abc&amp;x=1"');
    expect(r.html).toContain('expires in 60 minutes');
    expect(r.text).toContain('https://www.filtersfast.com/account/reset-password?token=abc&x=1');
    expect(r.templateData).toMatchObject({ url: 'https://www.filtersfast.com/account/reset-password?token=abc&x=1', name: 'Jo' });
  });
});

describe('helpers', () => {
  it('normalizes carriers from text or the tracking number shape', () => {
    expect(normalizeCarrier('UPS Ground')).toBe('UPS');
    expect(normalizeCarrier('FedEx Home Delivery')).toBe('FedEx');
    expect(normalizeCarrier('dhl')).toBe('DHL');
    expect(normalizeCarrier('Other', '1Z999AA10123456784')).toBe('UPS');
    expect(normalizeCarrier('', '9400111899223197428490')).toBe('USPS');
    expect(normalizeCarrier('', '794644790138')).toBe('FedEx');
    expect(normalizeCarrier('Courier', 'X1')).toBe('Courier');
    expect(normalizeCarrier('', 'X1')).toBe('Carrier');
  });

  it('builds tracking URLs per carrier and null otherwise', () => {
    expect(trackingUrl('USPS', '9400 1118')).toBe('https://tools.usps.com/go/TrackConfirmAction?tLabels=9400%201118');
    expect(trackingUrl('FedEx', '794644790138')).toBe('https://www.fedex.com/fedextrack/?trknbr=794644790138');
    expect(trackingUrl('DHL', '123')).toContain('dhl.com');
    expect(trackingUrl('Other', 'abc')).toBeNull();
    expect(trackingUrl('UPS', '')).toBeNull();
  });

  it('formats addresses and dates', () => {
    expect(formatAddressLines({ firstName: 'A', lastName: 'B', company: 'Co', line1: 'L1', line2: '', city: 'C', region: 'NC', postalCode: '1', country: 'CA' })).toEqual(['A B', 'Co', 'L1', 'C, NC 1', 'CA']);
    expect(formatEmailDate('2026-09-11 23:30:00')).toBe('September 11, 2026');
    expect(formatEmailDate(undefined)).toBe('');
    expect(orderStatusUrl('https://x', 'FF1', 'a+b@c.d')).toBe('https://x/track-order?number=FF1&email=a%2Bb%40c.d');
  });
});
