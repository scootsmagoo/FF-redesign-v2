import { formatMoney } from './pricing';

/**
 * Transactional email templates: order confirmation, shipment notice, password reset.
 *
 * Pure functions: they take plain data and return subject + HTML + text + the flat
 * `templateData` object a SendGrid dynamic template expects. The data keys mirror the
 * legacy `_INCappEmail_.asp` substitutions (`firstname`, `ordernumber`, `ordertotal`,
 * `order.items[].eachPrice` …) so the existing SendGrid templates keep working when their
 * ids are configured; the inline HTML is used otherwise.
 *
 * Layout follows the brand guide: centred logo on white, single column, 600px, orange
 * rounded buttons, links in brand blue.
 */

export interface EmailAddress {
  firstName?: string;
  lastName?: string;
  company?: string;
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

export interface EmailOrderLine {
  sku: string;
  name: string;
  optionLabel?: string | null;
  qty: number;
  /** effective unit price after option and quantity tier, before promo discount */
  unitPriceCents: number;
  discountCents?: number;
  subscriptionMonths?: number | null;
}

export interface OrderEmailData {
  /** canonical origin, e.g. https://www.filtersfast.com (no trailing slash) */
  siteUrl: string;
  number: string;
  email: string;
  /** ISO timestamp or SQLite `current_timestamp` text */
  placedAt?: string;
  shipTo: EmailAddress;
  shippingMethod?: string | null;
  lines: EmailOrderLine[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  donationCents: number;
  totalCents: number;
  promoCodes?: string[];
}

export interface ShipmentEmailData extends OrderEmailData {
  carrier?: string | null;
  trackingNumber?: string | null;
  shippedAt?: string | null;
}

export interface PasswordResetEmailData {
  siteUrl: string;
  name?: string | null;
  url: string;
  expiresMinutes?: number;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  /** flat substitutions for a provider-hosted dynamic template */
  templateData: Record<string, unknown>;
}

export const SUPPORT_PHONE = '(866) 438-3458';
export const SUPPORT_EMAIL = 'support@filtersfast.com';

const BRAND = {
  orange: '#f26722',
  blue: '#054f97',
  ink: '#111111',
  muted: '#666666',
  border: '#e5e7eb',
  surface: '#f6f7f9',
};

export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Carrier tracking page for a tracking number, or null when the carrier is unknown. Ported from the legacy include. */
export function trackingUrl(carrier: string | null | undefined, trackingNumber: string | null | undefined): string | null {
  const n = (trackingNumber ?? '').trim();
  if (!n) return null;
  const c = normalizeCarrier(carrier, n);
  const q = encodeURIComponent(n);
  switch (c) {
    case 'UPS':
      return `https://www.ups.com/track?tracknum=${q}`;
    case 'FedEx':
      return `https://www.fedex.com/fedextrack/?trknbr=${q}`;
    case 'DHL':
      return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${q}`;
    case 'USPS':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${q}`;
    default:
      return null;
  }
}

/** UPS | FedEx | DHL | USPS | the input as given. Guesses from the number's shape when the carrier text is unhelpful. */
export function normalizeCarrier(carrier: string | null | undefined, trackingNumber = ''): string {
  const c = (carrier ?? '').trim();
  const u = c.toUpperCase();
  if (u.includes('UPS')) return 'UPS';
  if (u.includes('FEDEX')) return 'FedEx';
  if (u.includes('DHL')) return 'DHL';
  if (u.includes('USPS') || u.includes('POSTAL')) return 'USPS';
  const n = trackingNumber.replace(/\s+/g, '').toUpperCase();
  if (/^1Z[0-9A-Z]{16}$/.test(n)) return 'UPS';
  if (/^(94|93|92|95)\d{18,24}$/.test(n)) return 'USPS';
  if (/^\d{12}$|^\d{15}$|^\d{20}$/.test(n)) return 'FedEx';
  return c || 'Carrier';
}

export function formatAddressLines(a: EmailAddress): string[] {
  const name = `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim();
  const cityLine = `${a.city ?? ''}${a.city && a.region ? ', ' : ''}${a.region ?? ''} ${a.postalCode ?? ''}`.trim();
  return [name, a.company, a.line1, a.line2, cityLine, a.country && a.country.toUpperCase() !== 'US' ? a.country : ''].filter((x): x is string => Boolean(x && x.trim()));
}

export function formatEmailDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso.includes('T') || iso.endsWith('Z') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' });
}

/** Guest-safe link to the order (number + email); signed-in customers are redirected to their account by the page. */
export function orderStatusUrl(siteUrl: string, number: string, email: string): string {
  return `${siteUrl}/track-order?number=${encodeURIComponent(number)}&email=${encodeURIComponent(email)}`;
}

// ---------- layout ----------

function layout(opts: { siteUrl: string; preheader: string; title: string; body: string }): string {
  const { siteUrl } = opts;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.surface};font-family:'Museo Sans Rounded',Lato,Verdana,Helvetica,Arial,sans-serif;color:${BRAND.ink};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.surface};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:8px;border:1px solid ${BRAND.border};">
<tr><td align="center" style="padding:28px 24px 8px;">
<a href="${escapeHtml(siteUrl)}" style="text-decoration:none;"><img src="${escapeHtml(siteUrl)}/brand/FF-shield-logo.png" alt="FiltersFast.com" width="220" style="display:block;width:220px;max-width:100%;height:auto;border:0;"></a>
</td></tr>
<tr><td style="padding:8px 24px 24px;font-size:16px;line-height:1.5;">
${opts.body}
</td></tr>
<tr><td style="padding:16px 24px 24px;border-top:1px solid ${BRAND.border};font-size:13px;line-height:1.5;color:${BRAND.muted};" align="center">
Questions? Call <a href="tel:8664383458" style="color:${BRAND.blue};">${SUPPORT_PHONE}</a> or email <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND.blue};">${SUPPORT_EMAIL}</a>.<br>
Filters Fast, LLC &middot; <a href="${escapeHtml(siteUrl)}" style="color:${BRAND.blue};">FiltersFast.com</a> &middot; Filter. Purify. Protect.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px auto;"><tr><td align="center" style="background:${BRAND.orange};border-radius:8px;">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;font-size:18px;font-weight:bold;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;color:${BRAND.blue};">${escapeHtml(text)}</h1>`;
}

function h2(text: string): string {
  return `<h2 style="margin:24px 0 8px;font-size:18px;line-height:1.3;color:${BRAND.ink};">${escapeHtml(text)}</h2>`;
}

function p(html: string): string {
  return `<p style="margin:0 0 12px;">${html}</p>`;
}

function itemsTable(lines: EmailOrderLine[]): string {
  const rows = lines
    .map((l) => {
      const detail = [l.optionLabel ? escapeHtml(l.optionLabel) : '', l.subscriptionMonths ? `Home Filter Club &middot; every ${l.subscriptionMonths} months` : ''].filter(Boolean).join(' &middot; ');
      const lineTotal = l.unitPriceCents * l.qty - (l.discountCents ?? 0);
      return `<tr>
<td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};vertical-align:top;">
<div style="font-weight:bold;">${escapeHtml(l.name)}</div>
<div style="font-size:13px;color:${BRAND.muted};">Part #: ${escapeHtml(l.sku)}${detail ? ` &middot; ${detail}` : ''}</div>
</td>
<td align="center" style="padding:10px 8px;border-bottom:1px solid ${BRAND.border};vertical-align:top;white-space:nowrap;">${l.qty}</td>
<td align="right" style="padding:10px 0;border-bottom:1px solid ${BRAND.border};vertical-align:top;white-space:nowrap;">${formatMoney(lineTotal)}${l.discountCents ? `<div style="font-size:12px;color:${BRAND.muted};">after ${formatMoney(l.discountCents)} off</div>` : ''}</td>
</tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;">
<tr>
<th align="left" style="padding:0 0 6px;font-size:13px;color:${BRAND.muted};font-weight:normal;border-bottom:2px solid ${BRAND.border};">Item</th>
<th align="center" style="padding:0 8px 6px;font-size:13px;color:${BRAND.muted};font-weight:normal;border-bottom:2px solid ${BRAND.border};">Qty</th>
<th align="right" style="padding:0 0 6px;font-size:13px;color:${BRAND.muted};font-weight:normal;border-bottom:2px solid ${BRAND.border};">Price</th>
</tr>${rows}</table>`;
}

function totalsTable(d: OrderEmailData): string {
  const row = (label: string, value: string, opts: { bold?: boolean; color?: string } = {}) =>
    `<tr><td style="padding:4px 0;${opts.bold ? 'font-weight:bold;font-size:17px;border-top:1px solid ' + BRAND.border + ';padding-top:8px;' : ''}${opts.color ? `color:${opts.color};` : ''}">${label}</td><td align="right" style="padding:4px 0;white-space:nowrap;${opts.bold ? 'font-weight:bold;font-size:17px;border-top:1px solid ' + BRAND.border + ';padding-top:8px;' : ''}${opts.color ? `color:${opts.color};` : ''}">${value}</td></tr>`;
  const codes = d.promoCodes?.filter(Boolean) ?? [];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;margin-top:8px;">
${row('Subtotal', formatMoney(d.subtotalCents))}
${d.discountCents > 0 ? row(`Discounts${codes.length ? ` (${escapeHtml(codes.join(', '))})` : ''}`, `-${formatMoney(d.discountCents)}`, { color: '#2e8b2a' }) : ''}
${row('Shipping', d.shippingCents === 0 ? 'FREE' : formatMoney(d.shippingCents))}
${row('Tax', formatMoney(d.taxCents))}
${d.donationCents > 0 ? row('Donation', formatMoney(d.donationCents)) : ''}
${row('Total', formatMoney(d.totalCents), { bold: true })}
</table>`;
}

function addressBlock(title: string, lines: string[], extra?: string | null): string {
  return `${h2(title)}<p style="margin:0;">${lines.map(escapeHtml).join('<br>')}${extra ? `<br><span style="color:${BRAND.muted};">${escapeHtml(extra)}</span>` : ''}</p>`;
}

function textItems(lines: EmailOrderLine[]): string {
  return lines
    .map((l) => {
      const lineTotal = l.unitPriceCents * l.qty - (l.discountCents ?? 0);
      const detail = [l.optionLabel, l.subscriptionMonths ? `Home Filter Club every ${l.subscriptionMonths} months` : ''].filter(Boolean).join(', ');
      return `  ${l.qty} x ${l.name}${detail ? ` (${detail})` : ''} [${l.sku}] ${formatMoney(lineTotal)}`;
    })
    .join('\n');
}

function textTotals(d: OrderEmailData): string {
  const out = [`  Subtotal: ${formatMoney(d.subtotalCents)}`];
  if (d.discountCents > 0) out.push(`  Discounts: -${formatMoney(d.discountCents)}`);
  out.push(`  Shipping: ${d.shippingCents === 0 ? 'FREE' : formatMoney(d.shippingCents)}`);
  out.push(`  Tax: ${formatMoney(d.taxCents)}`);
  if (d.donationCents > 0) out.push(`  Donation: ${formatMoney(d.donationCents)}`);
  out.push(`  Total: ${formatMoney(d.totalCents)}`);
  return out.join('\n');
}

function textFooter(siteUrl: string): string {
  return `Questions? Call ${SUPPORT_PHONE} or email ${SUPPORT_EMAIL}.\nFilters Fast, LLC - ${siteUrl}`;
}

/** The legacy SendGrid substitution set shared by the confirmation and shipment templates. */
function legacyOrderData(d: OrderEmailData): Record<string, unknown> {
  return {
    firstname: d.shipTo.firstName ?? '',
    ordernumber: d.number,
    ordertotal: formatMoney(d.totalCents),
    orderDiscount: formatMoney(d.discountCents),
    orderShipping: formatMoney(d.shippingCents),
    orderHandling: formatMoney(0),
    DonationAmount: formatMoney(d.donationCents),
    orderTax: formatMoney(d.taxCents),
    orderSubtotal: formatMoney(d.subtotalCents),
    orderDate: formatEmailDate(d.placedAt),
    orderUrl: orderStatusUrl(d.siteUrl, d.number, d.email),
    order: {
      items: d.lines.map((l) => ({
        sku: l.sku,
        quantity: String(l.qty),
        description: l.optionLabel ? `${l.name} (${l.optionLabel})` : l.name,
        eachPrice: formatMoney(l.unitPriceCents),
        linePrice: formatMoney(l.unitPriceCents * l.qty - (l.discountCents ?? 0)),
      })),
    },
  };
}

// ---------- templates ----------

export function renderOrderConfirmation(d: OrderEmailData): RenderedEmail {
  const first = d.shipTo.firstName?.trim() || 'there';
  const url = orderStatusUrl(d.siteUrl, d.number, d.email);
  const shipLines = formatAddressLines(d.shipTo);
  const hasSubscription = d.lines.some((l) => l.subscriptionMonths);
  const subject = `Your FiltersFast.com order ${d.number}`;
  const html = layout({
    siteUrl: d.siteUrl,
    title: subject,
    preheader: `Thanks, ${first}. Order ${d.number} is confirmed for ${formatMoney(d.totalCents)}.`,
    body: [
      h1('Thanks for your order!'),
      p(`Hi ${escapeHtml(first)}, we received order <strong>${escapeHtml(d.number)}</strong>${d.placedAt ? ` on ${escapeHtml(formatEmailDate(d.placedAt))}` : ''}. We'll send another email with tracking as soon as it ships.`),
      button(url, 'View Your Order'),
      h2('Items'),
      itemsTable(d.lines),
      totalsTable(d),
      hasSubscription ? p(`<span style="color:${BRAND.muted};font-size:14px;">Home Filter Club items ship again on the schedule you chose. Manage them any time from <a href="${escapeHtml(d.siteUrl)}/account/subscriptions" style="color:${BRAND.blue};">your account</a>.</span>`) : '',
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="50%" style="vertical-align:top;padding-right:12px;">${addressBlock('Ships to', shipLines, d.shippingMethod)}</td>
<td width="50%" style="vertical-align:top;">${h2('Order details')}<p style="margin:0;">Order number: <strong>${escapeHtml(d.number)}</strong><br>Email: ${escapeHtml(d.email)}</p></td>
</tr></table>`,
      p(`<span style="font-size:14px;color:${BRAND.muted};">Need to change something? Reply to this email or contact us and mention order ${escapeHtml(d.number)}. See our <a href="${escapeHtml(d.siteUrl)}/returns" style="color:${BRAND.blue};">Return Policy</a> and <a href="${escapeHtml(d.siteUrl)}/shipping-policy" style="color:${BRAND.blue};">Shipping Policy</a>.</span>`),
    ].join('\n'),
  });
  const text = [
    `Thanks for your order, ${first}!`,
    '',
    `Order ${d.number}${d.placedAt ? ` placed ${formatEmailDate(d.placedAt)}` : ''}. We'll email you tracking as soon as it ships.`,
    `View your order: ${url}`,
    '',
    'Items:',
    textItems(d.lines),
    '',
    textTotals(d),
    '',
    `Ships to:\n  ${shipLines.join('\n  ')}${d.shippingMethod ? `\n  ${d.shippingMethod}` : ''}`,
    '',
    textFooter(d.siteUrl),
  ].join('\n');
  return { subject, html, text, templateData: legacyOrderData(d) };
}

export function renderShipmentNotice(d: ShipmentEmailData): RenderedEmail {
  const first = d.shipTo.firstName?.trim() || 'there';
  const carrier = normalizeCarrier(d.carrier, d.trackingNumber ?? '');
  const track = trackingUrl(carrier, d.trackingNumber);
  const orderUrl = orderStatusUrl(d.siteUrl, d.number, d.email);
  const shipLines = formatAddressLines(d.shipTo);
  const tn = (d.trackingNumber ?? '').trim();
  const subject = `Your FiltersFast.com order ${d.number} has shipped`;
  const trackingHtml = tn ? (track ? `<a href="${escapeHtml(track)}" style="color:${BRAND.blue};">${escapeHtml(tn)}</a>` : escapeHtml(tn)) : '';
  const html = layout({
    siteUrl: d.siteUrl,
    title: subject,
    preheader: tn ? `${carrier} tracking ${tn}` : `Order ${d.number} is on its way.`,
    body: [
      h1('Your order is on its way!'),
      p(`Hi ${escapeHtml(first)}, order <strong>${escapeHtml(d.number)}</strong> shipped${d.shippedAt ? ` on ${escapeHtml(formatEmailDate(d.shippedAt))}` : ''}${tn ? ` via ${escapeHtml(carrier)}` : ''}.`),
      tn ? p(`Tracking number: <strong>${trackingHtml}</strong><br><span style="font-size:13px;color:${BRAND.muted};">Tracking can take a few hours to show movement after the label is created.</span>`) : '',
      track ? button(track, 'Track Your Package') : button(orderUrl, 'View Your Order'),
      h2('What shipped'),
      itemsTable(d.lines),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="50%" style="vertical-align:top;padding-right:12px;">${addressBlock('Ships to', shipLines, d.shippingMethod)}</td>
<td width="50%" style="vertical-align:top;">${h2('Order details')}<p style="margin:0;">Order number: <strong>${escapeHtml(d.number)}</strong><br>Total: ${formatMoney(d.totalCents)}<br><a href="${escapeHtml(orderUrl)}" style="color:${BRAND.blue};">View order</a></p></td>
</tr></table>`,
    ].join('\n'),
  });
  const text = [
    `Good news, ${first}: order ${d.number} has shipped${tn ? ` via ${carrier}` : ''}.`,
    ...(tn ? [`Tracking number: ${tn}${track ? `\nTrack it: ${track}` : ''}`] : []),
    `View your order: ${orderUrl}`,
    '',
    'What shipped:',
    textItems(d.lines),
    '',
    `Ships to:\n  ${shipLines.join('\n  ')}`,
    '',
    textFooter(d.siteUrl),
  ].join('\n');
  const nameAndAddress = shipLines.map(escapeHtml).join('<br>');
  return {
    subject,
    html,
    text,
    templateData: {
      ...legacyOrderData(d),
      shipped: true,
      shippingNameAndAddress: nameAndAddress,
      shippingMethod: carrier,
      trackingNumber: trackingHtml,
      trackingUrl: track ?? '',
      trackingNumberPlain: tn,
    },
  };
}

export function renderPasswordReset(d: PasswordResetEmailData): RenderedEmail {
  const name = d.name?.trim() || 'there';
  const minutes = d.expiresMinutes ?? 60;
  const subject = 'Reset your FiltersFast.com password';
  const html = layout({
    siteUrl: d.siteUrl,
    title: subject,
    preheader: `Use this link within ${minutes} minutes to choose a new password.`,
    body: [
      h1('Reset your password'),
      p(`Hi ${escapeHtml(name)}, we received a request to reset the password for your FiltersFast.com account.`),
      button(d.url, 'Reset Password'),
      p(`<span style="font-size:14px;color:${BRAND.muted};">This link expires in ${minutes} minutes. If you didn't ask for a reset, you can ignore this email and your password will stay the same.</span>`),
      p(`<span style="font-size:13px;color:${BRAND.muted};">If the button doesn't work, copy this address into your browser:<br><a href="${escapeHtml(d.url)}" style="color:${BRAND.blue};word-break:break-all;">${escapeHtml(d.url)}</a></span>`),
    ].join('\n'),
  });
  const text = [`Hi ${name},`, '', 'We received a request to reset the password for your FiltersFast.com account.', `Reset it here (link expires in ${minutes} minutes): ${d.url}`, '', "If you didn't ask for this, ignore this email and your password will stay the same.", '', textFooter(d.siteUrl)].join('\n');
  return { subject, html, text, templateData: { url: d.url, name: d.name ?? '', firstname: d.name ?? '', expiresMinutes: minutes } };
}
