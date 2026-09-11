import { eq } from 'drizzle-orm';
import { orderItems, orders, shipments } from '@ff/db';
import { renderOrderConfirmation, renderPasswordReset, renderShipmentNotice, type EmailAddress, type OrderEmailData, type RenderedEmail } from '@ff/domain/emails';
import { env } from 'cloudflare:workers';
import { getDb } from './db';
import { getProviders } from './providers';

/**
 * Transactional email: loads what the template needs from D1, renders it with the pure
 * templates in `@ff/domain/emails`, and hands it to the configured provider.
 *
 * A failed send is logged and reported, never thrown: an order must not fail because the
 * receipt could not be delivered.
 */

/** Kinds with a SendGrid dynamic-template option, plus manager-sent kinds that always use the inline HTML. */
export type EmailKind = 'order-confirmation' | 'shipment' | 'password-reset' | 'order-status' | 'backorder-notice' | 'newsletter';

type EmailEnv = {
  SITE_URL?: string;
  /** Optional SendGrid dynamic template ids (d-…). When set, the provider sends the template with `templateData` instead of the inline HTML. */
  SENDGRID_TEMPLATE_ORDER_CONFIRMATION?: string;
  SENDGRID_TEMPLATE_SHIPMENT?: string;
  SENDGRID_TEMPLATE_PASSWORD_RESET?: string;
};

const cfg = env as unknown as EmailEnv;

export function siteUrl(): string {
  return (cfg.SITE_URL ?? 'http://localhost:4321').replace(/\/+$/, '');
}

/** The provider template id for a kind: the SendGrid id when configured, else the internal name (inline HTML is used). */
export function templateIdFor(kind: EmailKind): string {
  const map: Partial<Record<EmailKind, string | undefined>> = {
    'order-confirmation': cfg.SENDGRID_TEMPLATE_ORDER_CONFIRMATION,
    shipment: cfg.SENDGRID_TEMPLATE_SHIPMENT,
    'password-reset': cfg.SENDGRID_TEMPLATE_PASSWORD_RESET,
  };
  const id = map[kind]?.trim();
  return id || kind;
}

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export async function sendRendered(kind: EmailKind, to: string, rendered: RenderedEmail): Promise<SendResult> {
  try {
    const r = await getProviders().email.send({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateId: templateIdFor(kind),
      templateData: rendered.templateData,
    });
    if (!r.ok) console.error(`[email] ${kind} to=${to} failed: ${r.error ?? 'unknown error'}`);
    return r;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[email] ${kind} to=${to} threw: ${error}`);
    return { ok: false, error };
  }
}

function parseAddress(json: string): EmailAddress {
  try {
    return JSON.parse(json) as EmailAddress;
  } catch {
    return {};
  }
}

function parseCodes(json: string | null): string[] {
  try {
    return (JSON.parse(json ?? '[]') as string[]).filter(Boolean);
  } catch {
    return [];
  }
}

/** Everything the order templates need, straight from the stored order. Null when the order does not exist. */
export async function loadOrderEmailData(orderId: number): Promise<OrderEmailData | null> {
  const db = getDb();
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(orderItems.id);
  return {
    siteUrl: siteUrl(),
    number: order.number,
    email: order.email,
    placedAt: order.placedAt,
    shipTo: parseAddress(order.shippingAddress),
    shippingMethod: order.shippingMethod,
    lines: items.map((i) => ({
      sku: i.sku,
      name: i.name,
      optionLabel: i.optionLabel,
      qty: i.qty,
      unitPriceCents: i.unitPriceCents,
      discountCents: i.discountCents,
      subscriptionMonths: i.subscriptionMonths,
    })),
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    shippingCents: order.shippingCents,
    taxCents: order.taxCents,
    donationCents: order.donationCents,
    totalCents: order.totalCents,
    promoCodes: parseCodes(order.promoCodes),
  };
}

export async function sendOrderConfirmation(orderId: number): Promise<SendResult> {
  const data = await loadOrderEmailData(orderId);
  if (!data) return { ok: false, error: 'Order not found' };
  return sendRendered('order-confirmation', data.email, renderOrderConfirmation(data));
}

/** Shipment notice for one shipment row (the latest one when `shipmentId` is omitted). */
export async function sendShipmentNotice(orderId: number, shipmentId?: number): Promise<SendResult> {
  const data = await loadOrderEmailData(orderId);
  if (!data) return { ok: false, error: 'Order not found' };
  const db = getDb();
  const rows = await db.select().from(shipments).where(shipmentId ? eq(shipments.id, shipmentId) : eq(shipments.orderId, orderId));
  const ship = shipmentId ? rows[0] : rows.sort((a, b) => b.id - a.id)[0];
  if (!ship || ship.orderId !== orderId) return { ok: false, error: 'Shipment not found' };
  return sendRendered('shipment', data.email, renderShipmentNotice({ ...data, carrier: ship.carrier, trackingNumber: ship.trackingNumber, shippedAt: ship.shippedAt }));
}

export async function sendPasswordReset(to: string, name: string | null | undefined, url: string, expiresMinutes = 60): Promise<SendResult> {
  return sendRendered('password-reset', to, renderPasswordReset({ siteUrl: siteUrl(), name, url, expiresMinutes }));
}

/** Sample data for the manager preview page, so templates can be checked without placing an order. */
export function sampleOrderEmailData(): OrderEmailData {
  return {
    siteUrl: siteUrl(),
    number: 'FFSAMPLE01',
    email: 'customer@example.com',
    placedAt: new Date().toISOString(),
    shipTo: { firstName: 'Taylor', lastName: 'Reed', line1: '123 Maple Street', line2: 'Apt 4', city: 'Monroe', region: 'NC', postalCode: '28110', country: 'US' },
    shippingMethod: 'Economy (3-7 business days)',
    lines: [
      { sku: 'FFC20251', name: '20x25x1 Air Filter MERV 8 Filters Fast 6-Pack', qty: 1, unitPriceCents: 5995 },
      { sku: 'EDR4RXD1', name: 'Whirlpool EDR4RXD1 everydrop Filter 4 Refrigerator Water Filter', optionLabel: '2-Pack', qty: 1, unitPriceCents: 8999, subscriptionMonths: 6 },
    ],
    subtotalCents: 14994,
    discountCents: 1000,
    shippingCents: 0,
    taxCents: 1049,
    donationCents: 57,
    totalCents: 15100,
    promoCodes: ['WELCOME10'],
  };
}
