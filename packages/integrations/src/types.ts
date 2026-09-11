import type { Cents } from '@ff/domain/pricing';

/** Postal address as captured at checkout. */
export interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  region: string; // state/province code
  postalCode: string;
  country: string; // ISO-3166 alpha-2
  phone?: string;
  email?: string;
}

export interface AddressValidationResult {
  valid: boolean;
  /** Provider-corrected address, when it differs from the input. */
  suggested?: Address;
  /** residential | commercial | po-box | military | unknown */
  classification: 'residential' | 'commercial' | 'po-box' | 'military' | 'unknown';
  messages: string[];
}

export interface AddressValidator {
  readonly name: string;
  validate(address: Address): Promise<AddressValidationResult>;
}

// ---------- shipping ----------

export interface ShipmentItem {
  sku: string;
  qty: number;
  weightOz?: number;
  freeShipping?: boolean;
}

export interface RateRequest {
  destination: Address;
  items: ShipmentItem[];
  subtotalCents: Cents;
  /** cart-level free-shipping entitlement (promo, Home Filter Club, VIP threshold) */
  freeShippingEligible: boolean;
}

export interface ShippingRate {
  /** stable id used in the cart/order, e.g. "economy", "fedex-2day" */
  id: string;
  label: string;
  carrier: string;
  priceCents: Cents;
  /** business days, inclusive range */
  minDays: number;
  maxDays: number;
  /** false for PO boxes with carriers that cannot deliver there */
  available: boolean;
}

export interface ShippingProvider {
  readonly name: string;
  getRates(req: RateRequest): Promise<ShippingRate[]>;
}

// ---------- tax ----------

export interface TaxLine {
  sku: string;
  qty: number;
  unitPriceCents: Cents;
  discountCents: Cents;
  taxExempt?: boolean;
}

export interface TaxRequest {
  destination: Address;
  lines: TaxLine[];
  shippingCents: Cents;
}

export interface TaxResult {
  taxCents: Cents;
  rate: number; // combined rate, e.g. 0.0725
  /** provider-specific breakdown, kept for order audit */
  detail?: Record<string, unknown>;
}

export interface TaxProvider {
  readonly name: string;
  calculate(req: TaxRequest): Promise<TaxResult>;
}

// ---------- payments ----------

export type PaymentMethodKind = 'card' | 'paypal' | 'applepay' | 'googlepay';

export interface PaymentRequest {
  orderNumber: string;
  amountCents: Cents;
  currency: string;
  method: PaymentMethodKind;
  /** opaque token from the client-side tokenizer (CyberSource Microform, PayPal order id, wallet token) */
  token: string;
  billing: Address;
  customerEmail: string;
  ip?: string;
}

export interface PaymentResult {
  ok: boolean;
  /** provider transaction reference to store on the order */
  transactionId?: string;
  /** vault token if the customer asked to save the method */
  vaultToken?: string;
  declineReason?: string;
  raw?: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: string;
  /** What the browser needs to render the payment form (public keys, capture context). */
  clientConfig(): Promise<Record<string, unknown>>;
  authorizeAndCapture(req: PaymentRequest): Promise<PaymentResult>;
  refund(transactionId: string, amountCents: Cents, reason?: string): Promise<PaymentResult>;
}

// ---------- email ----------

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** provider template id, when the provider renders the body */
  templateId?: string;
  templateData?: Record<string, unknown>;
  replyTo?: string;
  /** file attachments (content base64-encoded) */
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  /** base64 */
  content: string;
  type?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(msg: EmailMessage): Promise<{ ok: boolean; messageId?: string; error?: string }>;
}

export interface Providers {
  address: AddressValidator;
  shipping: ShippingProvider;
  tax: TaxProvider;
  payment: PaymentProvider;
  email: EmailProvider;
}
