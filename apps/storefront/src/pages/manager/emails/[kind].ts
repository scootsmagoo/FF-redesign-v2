import type { APIRoute } from 'astro';
import { sql } from 'drizzle-orm';
import { orders } from '@ff/db';
import { renderOrderConfirmation, renderPasswordReset, renderShipmentNotice, type RenderedEmail } from '@ff/domain/emails';
import { getDb } from '~/lib/db';
import { loadOrderEmailData, sampleOrderEmailData, siteUrl, type EmailKind } from '~/lib/emails';

/**
 * Renders one email template for the manager preview page (middleware already requires a
 * manager session on every /manager route). `?order=FF…` previews a real order; otherwise
 * sample data. `?view=text|data` returns the plain-text body or the SendGrid template data.
 */
export const GET: APIRoute = async ({ params, url }) => {
  const kind = params.kind as EmailKind;
  const view = url.searchParams.get('view') ?? 'html';
  const number = url.searchParams.get('order')?.trim();

  let data = sampleOrderEmailData();
  if (number) {
    const row = await getDb().query.orders.findFirst({ columns: { id: true }, where: sql`upper(${orders.number}) = upper(${number})` });
    const loaded = row ? await loadOrderEmailData(row.id) : null;
    if (!loaded) return new Response(`Order ${number} not found`, { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    data = loaded;
  }

  let rendered: RenderedEmail;
  switch (kind) {
    case 'order-confirmation':
      rendered = renderOrderConfirmation(data);
      break;
    case 'shipment':
      rendered = renderShipmentNotice({ ...data, carrier: 'UPS', trackingNumber: '1Z999AA10123456784', shippedAt: new Date().toISOString() });
      break;
    case 'password-reset':
      rendered = renderPasswordReset({ siteUrl: siteUrl(), name: data.shipTo.firstName, url: `${siteUrl()}/account/reset-password?token=sample-token` });
      break;
    default:
      return new Response('Unknown template', { status: 404 });
  }

  const noStore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
  if (view === 'text') return new Response(rendered.text, { headers: { ...noStore, 'Content-Type': 'text/plain; charset=utf-8' } });
  if (view === 'data') return new Response(JSON.stringify({ subject: rendered.subject, ...rendered.templateData }, null, 2), { headers: { ...noStore, 'Content-Type': 'application/json; charset=utf-8' } });
  return new Response(rendered.html, { headers: { ...noStore, 'Content-Type': 'text/html; charset=utf-8' } });
};
