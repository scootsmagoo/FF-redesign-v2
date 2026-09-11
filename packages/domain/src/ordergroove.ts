import { toCents, type Cents } from './pricing';

/**
 * Ordergroove (Home Filter Club subscription engine) contracts, ported from the legacy
 * `OrderInsertionAPI.asp`, `ogPriceApi.asp` and `ogMsiAuth.asp`. Pure parsing/formatting;
 * the storefront routes do the I/O.
 */

// ---------- tiny XML reader ----------
// The order XML is flat (no attributes we care about, no namespaces, no CDATA), so a
// small tag-walker is enough and avoids pulling an XML parser into the Worker.

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

/** Text of the first `<tag>…</tag>` inside `xml`, entity-decoded and trimmed; '' when absent or self-closing. */
export function xmlText(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i').exec(xml);
  return m ? decodeEntities(m[1] ?? '').trim() : '';
}

/** Inner XML of every `<tag>…</tag>` block, in document order. */
export function xmlBlocks(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1] ?? '');
  return out;
}

export function xmlEscape(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------- order insertion ----------

export interface OgAddress {
  firstName: string;
  lastName: string;
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface OgOrderItem {
  /** legacy product id, or "productId-optionId" (the option part is also in `optionId`) */
  productId: number;
  optionId: number | null;
  sku: string;
  name: string;
  qty: number;
  /** regular unit price sent by Ordergroove */
  priceCents: Cents;
  /** unit price after the subscription discount (what the customer is charged) */
  finalPriceCents: Cents;
  /** per-unit discount */
  discountCents: Cents;
}

export interface OgOrder {
  ogOrderId: string;
  ogDate: string; // YYYY-MM-DD
  ogCustomerId: string;
  /** legacy idCust; the v2 customers primary key */
  customerId: number | null;
  email: string;
  firstName: string;
  lastName: string;
  billing: OgAddress;
  shipping: OgAddress;
  /** CC | PayPal (legacy mapped CC → AuthorizeNet; v2 charges the customer's default vault token) */
  paymentMethod: string;
  /** PayPal billing agreement / vault token when present */
  tokenId: string;
  currency: string;
  subtotalCents: Cents; // Ordergroove's subtotal, *before* discount (legacy added orderDiscount back)
  discountCents: Cents;
  shippingCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
  items: OgOrderItem[];
}

export class OgOrderError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

function cents(s: string): Cents {
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) throw new OgOrderError(`Invalid amount "${s}"`, 'INVALID_AMOUNT');
  return toCents(n);
}

function address(xml: string, prefix: 'customerBilling' | 'customerShipping', fallback?: OgAddress): OgAddress {
  const f = (k: string) => xmlText(xml, `${prefix}${k}`);
  const or = (v: string, fb?: string) => (v ? v : (fb ?? ''));
  // Address1/Address2 are the split form; Address is the combined legacy field.
  const line1 = f('Address1') || f('Address');
  return {
    firstName: or(f('FirstName'), fallback?.firstName),
    lastName: or(f('LastName'), fallback?.lastName),
    company: or(f('Company'), fallback?.company) || undefined,
    line1: or(line1, fallback?.line1),
    line2: or(f('Address2'), fallback?.line2) || undefined,
    city: or(f('City'), fallback?.city),
    region: or(f('State'), fallback?.region).toUpperCase(),
    postalCode: or(f('Zip'), fallback?.postalCode),
    country: (or(f('Country'), fallback?.country) || 'US').toUpperCase(),
    phone: or(f('Phone'), fallback?.phone) || undefined,
  };
}

/** Parses and validates the Ordergroove order XML. Throws OgOrderError with a code Ordergroove can log. */
export function parseOgOrder(xml: string): OgOrder {
  if (!xml || !/<order[\s>]/i.test(xml)) throw new OgOrderError('Missing or malformed order XML', 'INVALID_XML');
  const head = xmlBlocks(xml, 'head')[0] ?? '';
  const customer = xmlBlocks(xml, 'customer')[0] ?? '';
  const itemsXml = xmlBlocks(xml, 'items')[0] ?? '';

  const ogOrderId = xmlText(head, 'orderOgId');
  if (!ogOrderId) throw new OgOrderError('orderOgId is required', 'MISSING_ORDER_ID');
  const email = xmlText(customer, 'customerEmail').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new OgOrderError('customerEmail is missing or invalid', 'INVALID_EMAIL');
  const partnerId = xmlText(customer, 'customerPartnerId');
  const customerId = /^\d+$/.test(partnerId) ? Number(partnerId) : null;

  const billing = address(customer, 'customerBilling');
  const shipping = address(customer, 'customerShipping', billing);
  for (const [label, a] of [
    ['billing', billing],
    ['shipping', shipping],
  ] as const) {
    if (!a.line1 || !a.city || !a.postalCode) throw new OgOrderError(`Incomplete ${label} address`, 'INVALID_ADDRESS');
  }

  const items = xmlBlocks(itemsXml, 'item').map((it, i): OgOrderItem => {
    const rawId = xmlText(it, 'product_id');
    const [pidText, optFromId] = rawId.split('-');
    const productId = Number(pidText);
    if (!Number.isInteger(productId) || productId <= 0) throw new OgOrderError(`Item ${i + 1}: product_id "${rawId}" is invalid`, 'INVALID_PRODUCT');
    const optText = xmlText(it, 'optionId') || optFromId || '';
    const optionId = /^\d+$/.test(optText) && Number(optText) > 0 ? Number(optText) : null;
    const qty = Number(xmlText(it, 'qty'));
    if (!Number.isInteger(qty) || qty <= 0) throw new OgOrderError(`Item ${i + 1}: qty must be a positive integer`, 'INVALID_QTY');
    const priceCents = cents(xmlText(it, 'price'));
    const finalText = xmlText(it, 'finalPrice');
    const discountCents = cents(xmlText(it, 'discount'));
    const finalPriceCents = finalText ? cents(finalText) : Math.max(0, priceCents - discountCents);
    return { productId, optionId, sku: xmlText(it, 'sku'), name: xmlText(it, 'name'), qty, priceCents, finalPriceCents, discountCents: Math.max(0, priceCents - finalPriceCents) };
  });
  if (!items.length) throw new OgOrderError('Order has no items', 'NO_ITEMS');

  const discountCents = cents(xmlText(head, 'orderDiscount'));
  return {
    ogOrderId,
    ogDate: xmlText(head, 'orderOgDate') || new Date().toISOString().slice(0, 10),
    ogCustomerId: xmlText(customer, 'customerOgId'),
    customerId,
    email,
    firstName: xmlText(customer, 'customerFirstName') || billing.firstName,
    lastName: xmlText(customer, 'customerLastName') || billing.lastName,
    billing,
    shipping,
    paymentMethod: xmlText(head, 'orderPaymentMethod') || 'CC',
    tokenId: xmlText(head, 'orderTokenId'),
    currency: (xmlText(head, 'orderCurrency') || 'USD').toUpperCase(),
    subtotalCents: cents(xmlText(head, 'orderSubtotalValue')) + discountCents,
    discountCents,
    shippingCents: cents(xmlText(head, 'orderShipping')),
    taxCents: cents(xmlText(head, 'orderSalesTax')),
    totalCents: cents(xmlText(head, 'orderTotalValue')),
    items,
  };
}

/** Legacy success body: `<order><code>SUCCESS</code><orderId>…</orderId><errorMsg /></order>`. */
export function ogSuccessXml(orderId: string | number): string {
  return `<?xml version="1.0" encoding="UTF-8"?><order><code>SUCCESS</code><orderId>${xmlEscape(orderId)}</orderId><errorMsg /></order>`;
}

export function ogErrorXml(code: string, message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><order><code>ERROR</code><errorCode>${xmlEscape(code)}</errorCode><errorMsg>${xmlEscape(message)}</errorMsg></order>`;
}

// ---------- price API ----------

export interface OgPriceRequest {
  productId: number;
  optionId: number | null;
  quantity: number;
}

/**
 * `ogPriceApi.asp` receives `json={"item":{"product":"1381-747","quantity":1}}` (form-encoded) and
 * answers `{"price":"67.45"}`. Accepts the raw form body, a `json` field value, or parsed JSON.
 */
export function parseOgPriceRequest(input: string | Record<string, unknown> | null | undefined): OgPriceRequest | null {
  let obj: unknown = input;
  if (typeof input === 'string') {
    let s = input.trim();
    if (s.startsWith('json=')) s = decodeURIComponent(s.slice(5).replace(/\+/g, ' '));
    try {
      obj = JSON.parse(s);
    } catch {
      return null;
    }
  }
  const item = (obj as { item?: Record<string, unknown> } | null)?.item ?? (obj as Record<string, unknown> | null);
  if (!item || typeof item !== 'object') return null;
  const product = String((item as Record<string, unknown>).product ?? (item as Record<string, unknown>).product_id ?? '');
  const [pid, opt] = product.split('-');
  const productId = Number(pid);
  if (!Number.isInteger(productId) || productId <= 0) return null;
  const optionId = opt && /^\d+$/.test(opt) && Number(opt) > 0 ? Number(opt) : null;
  const q = Number((item as Record<string, unknown>).quantity ?? 1);
  const quantity = Number.isInteger(q) && q > 0 ? q : 1;
  return { productId, optionId, quantity };
}

export function ogPriceJson(priceCents: Cents): string {
  return JSON.stringify({ price: (priceCents / 100).toFixed(2) });
}

// ---------- MSI / offers auth cookie ----------

/**
 * Ordergroove's `og_auth` cookie: `customerId|epochSeconds|HMAC-SHA256(customerId|epochSeconds, hashKey)`
 * (hex). Their front-end reads it to show the customer's subscriptions in the offer and MSI widgets.
 */
export async function ogAuthCookieValue(customerId: number | string, hashKey: string, nowMs = Date.now()): Promise<string> {
  const epoch = Math.floor(nowMs / 1000);
  const toSign = `${customerId}|${epoch}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(hashKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${toSign}|${hex}`;
}
