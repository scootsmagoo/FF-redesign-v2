import { ogAuthCookieValue, ogErrorXml, OgOrderError, ogPriceJson, ogSuccessXml, parseOgOrder, parseOgPriceRequest, xmlBlocks, xmlText } from './ordergroove';

// The sample Ordergroove sends (from the legacy include's test fixture), two items, one with an option.
const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?><order><head><orderOgId>936809397</orderOgId><orderOgDate>2026-08-25</orderOgDate><orderSourcePartnerId>2</orderSourcePartnerId><orderSourcePartnerName>FiltersFast</orderSourcePartnerName><orderItemsCount>1</orderItemsCount><orderSubtotalValue>140.90</orderSubtotalValue><orderSalesTax>0.00</orderSalesTax><orderSalesTaxPercent></orderSalesTaxPercent><orderDiscount>3.30</orderDiscount><orderShipping>0.00</orderShipping><orderTotalValue>140.9</orderTotalValue><orderCurrency>USD</orderCurrency><orderPaymentDataLocation>OG</orderPaymentDataLocation><orderPaymentMethod>CC</orderPaymentMethod><orderTokenId>1ht26333ub549952a</orderTokenId></head><customer><customerOgId>11301067</customerOgId><customerPartnerId>12647</customerPartnerId><customerName>Alex Hertzog</customerName><customerFirstName>Alex</customerFirstName><customerLastName>Hertzog</customerLastName><customerEmail>718b90d3-1332-4c5b-b08c-dfcd4823b45c@filtersfast.com</customerEmail><customerBillingFirstName>Alex</customerBillingFirstName><customerBillingLastName>Hertzog</customerBillingLastName><customerBillingAddress>5905 Stockbridge Dr </customerBillingAddress><customerBillingAddress1>5905 Stockbridge Dr</customerBillingAddress1><customerBillingAddress2></customerBillingAddress2><customerBillingCity>Monroe</customerBillingCity><customerBillingState>nc</customerBillingState><customerBillingZip>28110-8106</customerBillingZip><customerBillingPhone>7048215157</customerBillingPhone><customerBillingFax></customerBillingFax><customerBillingCompany></customerBillingCompany><customerBillingCountry>US</customerBillingCountry><customerShippingFirstName></customerShippingFirstName><customerShippingLastName></customerShippingLastName><customerShippingAddress></customerShippingAddress><customerShippingAddress1></customerShippingAddress1><customerShippingAddress2></customerShippingAddress2><customerShippingCity></customerShippingCity><customerShippingState></customerShippingState><customerShippingZip></customerShippingZip><customerShippingPhone></customerShippingPhone><customerShippingFax></customerShippingFax><customerShippingCompany></customerShippingCompany><customerShippingCountry></customerShippingCountry></customer><items><item><qty>1</qty><sku>EDR1RXD1</sku><name>everydrop&amp;reg; EDR1RXD1, FILTER 1 Refrigerator Water Filter</name><product_id>12531</product_id><discount>3.30</discount><tax_percent></tax_percent><finalPrice>62.65</finalPrice><price>65.95</price><filmore_enabled></filmore_enabled><optionId></optionId></item><item><qty>2</qty><sku>FFM13 6PK</sku><name>Merv 13 1" 20"x20" x1" Air Filter 6-pack</name><product_id>1381-747</product_id><discount>7.50</discount><tax_percent></tax_percent><finalPrice>67.45</finalPrice><price>74.95</price><filmore_enabled></filmore_enabled><optionId>747</optionId></item></items></order>`;

describe('xml helpers', () => {
  it('reads first-match text with entities decoded and lists repeated blocks', () => {
    expect(xmlText('<a><b>x &amp; y</b><b>z</b></a>', 'b')).toBe('x & y');
    expect(xmlText('<a><b/></a>', 'b')).toBe('');
    expect(xmlText('<a><b></b></a>', 'b')).toBe('');
    expect(xmlBlocks('<l><i>1</i><i>2</i></l>', 'i')).toEqual(['1', '2']);
  });
});

describe('parseOgOrder', () => {
  const o = parseOgOrder(SAMPLE);

  it('reads the head with the legacy subtotal-plus-discount rule', () => {
    expect(o.ogOrderId).toBe('936809397');
    expect(o.ogDate).toBe('2026-08-25');
    expect(o.subtotalCents).toBe(14420); // 140.90 + 3.30, as the legacy include did
    expect(o.discountCents).toBe(330);
    expect(o.shippingCents).toBe(0);
    expect(o.taxCents).toBe(0);
    expect(o.totalCents).toBe(14090);
    expect(o.paymentMethod).toBe('CC');
    expect(o.tokenId).toBe('1ht26333ub549952a');
    expect(o.currency).toBe('USD');
  });

  it('maps the customer and falls back to billing for an empty shipping block', () => {
    expect(o.customerId).toBe(12647);
    expect(o.ogCustomerId).toBe('11301067');
    expect(o.email).toBe('718b90d3-1332-4c5b-b08c-dfcd4823b45c@filtersfast.com');
    expect(o.billing).toMatchObject({ firstName: 'Alex', lastName: 'Hertzog', line1: '5905 Stockbridge Dr', city: 'Monroe', region: 'NC', postalCode: '28110-8106', country: 'US', phone: '7048215157' });
    expect(o.billing.company).toBeUndefined();
    expect(o.shipping).toEqual(o.billing);
  });

  it('parses items, including the "productId-optionId" form, and decodes double-escaped names', () => {
    expect(o.items).toHaveLength(2);
    expect(o.items[0]).toEqual({ productId: 12531, optionId: null, sku: 'EDR1RXD1', name: 'everydrop&reg; EDR1RXD1, FILTER 1 Refrigerator Water Filter', qty: 1, priceCents: 6595, finalPriceCents: 6265, discountCents: 330 });
    expect(o.items[1]).toMatchObject({ productId: 1381, optionId: 747, sku: 'FFM13 6PK', qty: 2, priceCents: 7495, finalPriceCents: 6745, discountCents: 750 });
  });

  it('rejects bad input with a code', () => {
    const codeOf = (xml: string) => {
      try {
        parseOgOrder(xml);
      } catch (e) {
        return e instanceof OgOrderError ? e.code : 'not-og';
      }
      return 'none';
    };
    expect(codeOf('')).toBe('INVALID_XML');
    expect(codeOf('<order><head></head></order>')).toBe('MISSING_ORDER_ID');
    expect(codeOf('<order><head><orderOgId>1</orderOgId></head><customer><customerEmail>nope</customerEmail></customer></order>')).toBe('INVALID_EMAIL');
    expect(codeOf(SAMPLE.replace('<customerBillingCity>Monroe</customerBillingCity>', '<customerBillingCity></customerBillingCity>'))).toBe('INVALID_ADDRESS');
    expect(codeOf(SAMPLE.replace(/<items>[\s\S]*<\/items>/, '<items></items>'))).toBe('NO_ITEMS');
    expect(codeOf(SAMPLE.replace('<qty>1</qty>', '<qty>0</qty>'))).toBe('INVALID_QTY');
    expect(codeOf(SAMPLE.replace('<product_id>12531</product_id>', '<product_id>abc</product_id>'))).toBe('INVALID_PRODUCT');
  });

  it('formats the legacy response bodies', () => {
    expect(ogSuccessXml(42)).toBe('<?xml version="1.0" encoding="UTF-8"?><order><code>SUCCESS</code><orderId>42</orderId><errorMsg /></order>');
    expect(ogErrorXml('AUTH', 'Bad <creds>')).toContain('<errorCode>AUTH</errorCode><errorMsg>Bad &lt;creds&gt;</errorMsg>');
  });
});

describe('price API', () => {
  it('parses the form-encoded legacy payload and plain JSON', () => {
    expect(parseOgPriceRequest('json=%7B%22item%22%3A%7B%22product%22%3A%221381-747%22%2C%22quantity%22%3A2%7D%7D')).toEqual({ productId: 1381, optionId: 747, quantity: 2 });
    expect(parseOgPriceRequest('{"item":{"product":"12531","quantity":"1"}}')).toEqual({ productId: 12531, optionId: null, quantity: 1 });
    expect(parseOgPriceRequest({ item: { product: 5 } })).toEqual({ productId: 5, optionId: null, quantity: 1 });
    expect(parseOgPriceRequest('json=nope')).toBeNull();
    expect(parseOgPriceRequest({ item: { product: 'x' } })).toBeNull();
    expect(ogPriceJson(6745)).toBe('{"price":"67.45"}');
  });
});

describe('og_auth cookie', () => {
  it('signs customerId|epoch with HMAC-SHA256 hex', async () => {
    const v = await ogAuthCookieValue(12647, 'secret', 1_757_600_000_000);
    const [id, epoch, sig] = v.split('|');
    expect(id).toBe('12647');
    expect(epoch).toBe('1757600000');
    // Precomputed with Node: createHmac('sha256', 'secret').update('12647|1757600000').digest('hex')
    expect(sig).toBe('d63f99384fe89706134452015218b1386b5b886395ad34d922bdc90cd1f0bb3e');
  });
});
