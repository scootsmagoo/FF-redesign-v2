import { eq } from 'drizzle-orm';
import { cartItems, orderItems, orders } from '@ff/db';
import { computeCartTotals, roundUpDonationCents, type CartTotals } from '@ff/domain/cart';
import { isValidPostalCode, regionsFor } from '@ff/domain/geo';
import type { Address, ShippingRate } from '@ff/integrations';
import { env } from 'cloudflare:workers';
import { getCartView, type CartView } from './cart';
import { getDb } from './db';
import { getProviders } from './providers';

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
    shippingCents,
  });

  let taxCents = 0;
  if (state.shipping && selectedRate) {
    const tax = await providers.tax.calculate({
      destination: state.shipping,
      lines: base.lines.map((l) => ({ sku: l.sku, qty: l.qty, unitPriceCents: l.effectiveUnitCents, discountCents: 0, taxExempt: l.taxExempt })),
      shippingCents: base.shippingCents,
    });
    taxCents = tax.taxCents;
  }

  const preDonation = base.subtotalCents - base.discountCents + base.shippingCents + taxCents;
  const donationCents = donationFor(state.donation, preDonation);

  const totals = computeCartTotals(cart.lines, {
    freeShippingThresholdCents: threshold,
    subscriptionPromoActive: true,
    firstSubscriptionOrder: true,
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
}

export interface PlacedOrder {
  number: string;
  accessKey: string;
  email: string;
  totalCents: number;
}

/** Charges, persists the order, clears the cart and checkout state, sends the confirmation. */
export async function placeOrder(session: Session, input: PlaceOrderInput): Promise<PlacedOrder> {
  const q = await buildQuote(session);
  const { state, cart, totals } = q;
  if (!cart.cartId || cart.lines.length === 0) throw new Error('Your cart is empty');
  if (!state.email || !state.shipping) throw new Error('Shipping details are missing');
  if (!q.selectedRate) throw new Error('Choose a shipping method');
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
  if (!payment.ok) throw new Error(payment.declineReason ?? 'Payment was declined');

  const db = getDb();
  const [order] = await db
    .insert(orders)
    .values({
      number,
      email: state.email,
      status: 'paid',
      currency: 'USD',
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      shippingCents: totals.shippingCents,
      taxCents: totals.taxCents,
      donationCents: totals.donationCents,
      totalCents: totals.totalCents,
      billingAddress: JSON.stringify(billing),
      shippingAddress: JSON.stringify(state.shipping),
      shippingMethod: q.selectedRate.label,
      paymentProvider: providers.payment.name,
      paymentRef: payment.transactionId,
      accessKey,
    })
    .returning({ id: orders.id });
  if (!order) throw new Error('Could not save the order');

  await db.batch([
    db.insert(orderItems).values(
      totals.lines.map((l) => ({
        orderId: order.id,
        productId: l.productId,
        sku: l.sku,
        name: l.name,
        qty: l.qty,
        unitPriceCents: l.effectiveUnitCents,
        discountCents: l.lineDiscountCents,
        subscriptionMonths: l.subscriptionMonths,
        returnable: true,
      })),
    ),
    db.delete(cartItems).where(eq(cartItems.cartId, cart.cartId)),
  ]);

  session?.delete(KEY);

  await providers.email.send({
    to: state.email,
    subject: `Your FiltersFast.com order ${number}`,
    templateId: 'order-confirmation',
    templateData: { number, totalCents: totals.totalCents, items: totals.lines.map((l) => ({ sku: l.sku, name: l.name, qty: l.qty })) },
    html: `<p>Thanks for your order ${number}. We'll email you when it ships.</p>`,
  });

  return { number, accessKey, email: state.email, totalCents: totals.totalCents };
}

/** FF + base36 timestamp + 3 random chars; unique enough and readable on the phone. */
function generateOrderNumber(): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.floor(Math.random() * 46656).toString(36).toUpperCase().padStart(3, '0');
  return `FF${t}${r}`;
}
