import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { addresses, cartItems, customers, orderItems, orders, saleRestrictions } from '@ff/db';
import { computeCartTotals, roundUpDonationCents, type CartTotals } from '@ff/domain/cart';
import { isValidPostalCode, regionsFor } from '@ff/domain/geo';
import type { Address, ShippingRate } from '@ff/integrations';
import { env } from 'cloudflare:workers';
import { getCartView, type CartView } from './cart';
import { getDb } from './db';
import { sendOrderConfirmation } from './emails';
import { getProviders } from './providers';
import { logPayment } from './payment-log';
import { consumeSingleUseCodes } from './promotions';

type Session = { get<T = unknown>(key: string): Promise<T | undefined>; set(key: string, value: unknown): void; delete(key: string): void } | undefined;

const KEY = 'checkout';

export interface CheckoutState {
  email?: string;
  shipping?: Address;
  billingSameAsShipping?: boolean;
  billing?: Address;
  shippingRateId?: string;
  /** 'none' | 'roundup' | cents as string, mirroring the legacy donateAmount select */
  donation?: string;
  smsOptIn?: boolean;
  newsletter?: boolean;
}

export async function getCheckout(session: Session): Promise<CheckoutState> {
  return (await session?.get<CheckoutState>(KEY)) ?? {};
}

export async function updateCheckout(session: Session, patch: Partial<CheckoutState>): Promise<CheckoutState> {
  if (!session) throw new Error('Sessions are not configured');
  const next = { ...(await getCheckout(session)), ...patch };
  session.set(KEY, next);
  return next;
}

/** Field-level validation for the address form. Returns {} when valid. */
export function validateAddress(a: Partial<Address>, prefix = ''): Record<string, string> {
  const errors: Record<string, string> = {};
  const req = (k: keyof Address, label: string) => {
    if (!a[k] || !String(a[k]).trim()) errors[prefix + k] = `${label} is required`;
  };
  req('firstName', 'First name');
  req('lastName', 'Last name');
  req('line1', 'Street address');
  req('city', 'City');
  req('postalCode', 'ZIP / postal code');
  req('country', 'Country');
  const country = a.country ?? 'US';
  const regions = regionsFor(country);
  if (regions && !(a.region && regions[a.region.toUpperCase()])) errors[prefix + 'region'] = 'Select a state or province';
  if (a.postalCode && !isValidPostalCode(country, a.postalCode)) errors[prefix + 'postalCode'] = 'Enter a valid postal code';
  return errors;
}

export interface Quote {
  cart: CartView;
  totals: CartTotals;
  rates: ShippingRate[];
  selectedRate: ShippingRate | null;
  taxCents: number;
  donationCents: number;
  state: CheckoutState;
}

/** Recomputes the whole order from cart + checkout state using the providers. Used by every step and by placeOrder. */
export async function buildQuote(session: Session): Promise<Quote> {
  const cart = await getCartView(session);
  const state = await getCheckout(session);
  const providers = getProviders();
  const threshold = Math.round(Number(env.FREE_SHIPPING_THRESHOLD ?? '99') * 100);

  let rates: ShippingRate[] = [];
  let selectedRate: ShippingRate | null = null;
  if (state.shipping && cart.lines.length) {
    rates = await providers.shipping.getRates({
      destination: state.shipping,
      items: cart.lines.map((l) => ({ sku: l.sku, qty: l.qty, freeShipping: l.freeShipping })),
      subtotalCents: cart.totals.subtotalCents - cart.totals.discountCents,
      freeShippingEligible: cart.totals.freeShippingEligible,
    });
    selectedRate = rates.find((r) => r.id === state.shippingRateId && r.available) ?? null;
  }

  const shippingCents = selectedRate?.priceCents ?? 0;
  const base = computeCartTotals(cart.lines, {
    freeShippingThresholdCents: threshold,
    subscriptionPromoActive: true,
    firstSubscriptionOrder: true,
    promoDiscountCents: cart.promo.discountCents,
    promoFreeShipping: cart.promo.freeShipping,
    shippingCents,
  });

  let taxCents = 0;
  if (state.shipping && selectedRate) {
    // Spread the order-level promo discount across lines in proportion to their value so tax is charged on what the customer pays.
    const merchandise = base.lines.reduce((s, l) => s + l.effectiveUnitCents * l.qty, 0);
    let allocated = 0;
    const taxLines = base.lines.map((l, i) => {
      const lineTotal = l.effectiveUnitCents * l.qty;
      const last = i === base.lines.length - 1;
      const share = merchandise > 0 ? (last ? base.promoDiscountCents - allocated : Math.round((base.promoDiscountCents * lineTotal) / merchandise)) : 0;
      allocated += share;
      return { sku: l.sku, qty: l.qty, unitPriceCents: l.effectiveUnitCents, discountCents: Math.min(share, lineTotal), taxExempt: l.taxExempt };
    });
    const tax = await providers.tax.calculate({ destination: state.shipping, lines: taxLines, shippingCents: base.shippingCents });
    taxCents = tax.taxCents;
  }

  const preDonation = base.subtotalCents - base.discountCents + base.shippingCents + taxCents;
  const donationCents = donationFor(state.donation, preDonation);

  const totals = computeCartTotals(cart.lines, {
    freeShippingThresholdCents: threshold,
    subscriptionPromoActive: true,
    firstSubscriptionOrder: true,
    promoDiscountCents: cart.promo.discountCents,
    promoFreeShipping: cart.promo.freeShipping,
    shippingCents,
    taxCents,
    donationCents,
  });

  return { cart, totals, rates, selectedRate, taxCents, donationCents, state };
}

export function donationFor(choice: string | undefined, preDonationTotal: number): number {
  if (!choice || choice === 'none') return 0;
  if (choice === 'roundup') return roundUpDonationCents(preDonationTotal);
  const cents = Number.parseInt(choice, 10);
  return Number.isFinite(cents) && cents > 0 && cents <= 10000 ? cents : 0;
}

export interface PlaceOrderInput {
  paymentToken: string;
  method: 'card' | 'paypal' | 'applepay' | 'googlepay';
  ip?: string;
  /** signed-in customer, if any; guest orders are matched to accounts later by email */
  customerId?: number | null;
}

export interface PlacedOrder {
  number: string;
  accessKey: string;
  email: string;
  totalCents: number;
}

/**
 * Cart lines that may not ship to the destination (legacy sale_restrictions: state-level rules for
 * items such as California-restricted filters, and country blocks for export-controlled products).
 */
export async function restrictedLines(lines: { productId: number; name: string }[], destination: Address): Promise<string[]> {
  if (!lines.length) return [];
  const country = destination.country.toUpperCase();
  const region = destination.region.toUpperCase();
  const rows = await getDb()
    .select({ productId: saleRestrictions.productId })
    .from(saleRestrictions)
    .where(and(inArray(saleRestrictions.productId, [...new Set(lines.map((l) => l.productId))]), eq(saleRestrictions.country, country), or(isNull(saleRestrictions.region), eq(saleRestrictions.region, region))));
  const blocked = new Set(rows.map((r) => r.productId));
  return lines.filter((l) => blocked.has(l.productId)).map((l) => l.name);
}

/** Charges, persists the order, clears the cart and checkout state, sends the confirmation. */
export async function placeOrder(session: Session, input: PlaceOrderInput): Promise<PlacedOrder> {
  const q = await buildQuote(session);
  const { state, cart, totals } = q;
  if (!cart.cartId || cart.lines.length === 0) throw new Error('Your cart is empty');
  if (!state.email || !state.shipping) throw new Error('Shipping details are missing');
  if (!q.selectedRate) throw new Error('Choose a shipping method');
  const blocked = await restrictedLines(cart.lines, state.shipping);
  if (blocked.length) throw new Error(`These items cannot be shipped to ${state.shipping.region || state.shipping.country}: ${blocked.join(', ')}`);
  const billing = state.billingSameAsShipping === false && state.billing ? state.billing : state.shipping;

  const number = generateOrderNumber();
  const accessKey = crypto.randomUUID();
  const providers = getProviders();

  const payment = await providers.payment.authorizeAndCapture({
    orderNumber: number,
    amountCents: totals.totalCents,
    currency: 'USD',
    method: input.method,
    token: input.paymentToken,
    billing,
    customerEmail: state.email,
    ip: input.ip,
  });
  await logPayment({ orderNumber: number, customerId: input.customerId ?? null, email: state.email, kind: 'authorize_capture', provider: providers.payment.name, method: input.method, amountCents: totals.totalCents, currency: 'USD', ok: payment.ok, transactionId: payment.transactionId ?? null, message: payment.ok ? null : (payment.declineReason ?? 'declined'), ipAddress: input.ip ?? null });
  if (!payment.ok) throw new Error(payment.declineReason ?? 'Payment was declined');

  const db = getDb();
  const order = await saveOrder({
    number,
    customerId: input.customerId ?? null,
    email: state.email,
    status: 'paid',
    subtotalCents: totals.subtotalCents,
    discountCents: totals.discountCents,
    shippingCents: totals.shippingCents,
    taxCents: totals.taxCents,
    donationCents: totals.donationCents,
    totalCents: totals.totalCents,
    billing,
    shipping: state.shipping,
    shippingMethod: q.selectedRate.label,
    paymentProvider: providers.payment.name,
    paymentRef: payment.transactionId ?? null,
    promoCodes: cart.promo.applied.map((a) => a.code),
    accessKey,
    lines: totals.lines.map((l) => ({
      productId: l.productId,
      sku: l.sku,
      name: l.name,
      optionLabel: l.optionLabel ?? null,
      qty: l.qty,
      unitPriceCents: l.effectiveUnitCents,
      discountCents: l.lineDiscountCents,
      subscriptionMonths: l.subscriptionMonths,
    })),
  });
  await db.delete(cartItems).where(eq(cartItems.cartId, cart.cartId));

  await consumeSingleUseCodes(cart.promo.applied.map((a) => a.code), order.id);
  if (input.customerId) await rememberAddress(input.customerId, state.shipping, state);
  session?.delete(KEY);

  // Receipt from the stored order (same path as the manager's "Resend"); a send failure never fails the order.
  await sendOrderConfirmation(order.id);

  return { number, accessKey, email: state.email, totalCents: totals.totalCents };
}

export interface SaveOrderLine {
  productId: number | null;
  sku: string;
  name: string;
  optionLabel?: string | null;
  qty: number;
  unitPriceCents: number;
  discountCents?: number;
  subscriptionMonths?: number | null;
  customSku?: string | null;
}

export interface SaveOrderInput {
  number: string;
  customerId: number | null;
  email: string;
  status: 'pending' | 'paid' | 'processing';
  currency?: string;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  donationCents?: number;
  totalCents: number;
  billing: Address;
  shipping: Address;
  shippingMethod: string | null;
  paymentProvider: string | null;
  paymentRef: string | null;
  promoCodes?: string[];
  /** referral / channel tag, e.g. "ordergroove/hfc" for subscription orders */
  attribution?: string | null;
  accessKey?: string;
  lines: SaveOrderLine[];
}

/** Inserts an order and its lines. Shared by checkout and the inbound order channels (Ordergroove). */
export async function saveOrder(input: SaveOrderInput): Promise<{ id: number; number: string; accessKey: string }> {
  const db = getDb();
  const accessKey = input.accessKey ?? crypto.randomUUID();
  const [order] = await db
    .insert(orders)
    .values({
      number: input.number,
      customerId: input.customerId,
      email: input.email,
      status: input.status,
      currency: input.currency ?? 'USD',
      subtotalCents: input.subtotalCents,
      discountCents: input.discountCents,
      shippingCents: input.shippingCents,
      taxCents: input.taxCents,
      donationCents: input.donationCents ?? 0,
      totalCents: input.totalCents,
      billingAddress: JSON.stringify(input.billing),
      shippingAddress: JSON.stringify(input.shipping),
      shippingMethod: input.shippingMethod,
      paymentProvider: input.paymentProvider,
      paymentRef: input.paymentRef,
      promoCodes: JSON.stringify(input.promoCodes ?? []),
      attribution: input.attribution ?? null,
      accessKey,
    })
    .returning({ id: orders.id });
  if (!order) throw new Error('Could not save the order');
  if (input.lines.length) {
    await db.insert(orderItems).values(
      input.lines.map((l) => ({
        orderId: order.id,
        productId: l.productId,
        sku: l.sku,
        name: l.name,
        optionLabel: l.optionLabel ?? null,
        qty: l.qty,
        unitPriceCents: l.unitPriceCents,
        discountCents: l.discountCents ?? 0,
        subscriptionMonths: l.subscriptionMonths ?? null,
        customSku: l.customSku ?? null,
        returnable: true,
      })),
    );
  }
  return { id: order.id, number: input.number, accessKey };
}

/** FF + base36 timestamp + 3 random chars; unique enough and readable on the phone. */
export function generateOrderNumber(): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.floor(Math.random() * 46656).toString(36).toUpperCase().padStart(3, '0');
  return `FF${t}${r}`;
}

/** Saves the shipping address to the customer's address book if new, and refreshes opt-ins. */
async function rememberAddress(customerId: number, a: Address, state: CheckoutState) {
  const db = getDb();
  const existing = await db.select({ id: addresses.id, line1: addresses.line1, postalCode: addresses.postalCode }).from(addresses).where(eq(addresses.customerId, customerId));
  const dup = existing.some((x) => x.line1.trim().toLowerCase() === a.line1.trim().toLowerCase() && x.postalCode.trim() === a.postalCode.trim());
  if (!dup) {
    await db.insert(addresses).values({
      customerId,
      firstName: a.firstName,
      lastName: a.lastName,
      company: a.company ?? null,
      line1: a.line1,
      line2: a.line2 ?? null,
      city: a.city,
      region: a.region,
      postalCode: a.postalCode,
      country: a.country,
      phone: a.phone ?? null,
      isDefaultShipping: existing.length === 0,
      isDefaultBilling: existing.length === 0,
    });
  }
  await db.update(customers).set({ newsletter: Boolean(state.newsletter), smsOptIn: Boolean(state.smsOptIn) }).where(eq(customers.id, customerId));
}
