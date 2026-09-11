import type { APIRoute } from 'astro';
import { ogErrorXml, OgOrderError, ogSuccessXml, parseOgOrder } from '@ff/domain/ordergroove';
import { clientIp, createOrderFromOg, finishInboundEvent, ordergrooveCredentialsOk, recordInboundEvent } from '~/lib/inbound';

export const prerender = false;

/**
 * Ordergroove order insertion (legacy `OrderInsertionAPI.asp`). Ordergroove posts a form with
 * `username`, `password` and `xml` and expects an XML body back:
 *   <order><code>SUCCESS</code><orderId>…</orderId><errorMsg /></order>
 *   <order><code>ERROR</code><errorCode>…</errorCode><errorMsg>…</errorMsg></order>
 * Credentials come from ORDERGROOVE_API_USER (var) + ORDERGROOVE_API_PASSWORD (secret).
 * A resend of the same orderOgId returns the original order id instead of inserting twice.
 */
const xml = (body: string, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' } });

export const POST: APIRoute = async ({ request }) => {
  let username: string | null = null;
  let password: string | null = null;
  let orderXml = '';
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('form')) {
    const form = await request.formData();
    username = (form.get('username') as string | null) ?? null;
    password = (form.get('password') as string | null) ?? null;
    orderXml = ((form.get('xml') ?? form.get('order_xml') ?? form.get('xmlText')) as string | null) ?? '';
  } else {
    // Also accept raw XML with HTTP Basic auth, for anyone testing with curl.
    orderXml = await request.text();
    const auth = request.headers.get('authorization') ?? '';
    if (auth.toLowerCase().startsWith('basic ')) {
      const [u, ...p] = atob(auth.slice(6)).split(':');
      username = u ?? null;
      password = p.join(':');
    }
  }

  if (!ordergrooveCredentialsOk(username, password)) return xml(ogErrorXml('AUTH', 'Security: API Credentials Could Not Be Verified'), 401);

  let og;
  try {
    og = parseOgOrder(orderXml);
  } catch (e) {
    const err = e instanceof OgOrderError ? e : new OgOrderError(e instanceof Error ? e.message : 'Invalid XML', 'INVALID_XML');
    return xml(ogErrorXml(err.code, err.message), 400);
  }

  const { event, duplicate } = await recordInboundEvent('ordergroove', og.ogOrderId, orderXml, clientIp(request));
  if (duplicate) {
    if (event.status === 'ok' && event.orderId) return xml(ogSuccessXml(event.orderId));
    if (event.status === 'error') return xml(ogErrorXml('DUPLICATE', `Order ${og.ogOrderId} was already received and failed: ${event.error ?? 'unknown error'}`), 409);
    return xml(ogErrorXml('DUPLICATE', `Order ${og.ogOrderId} is already being processed`), 409);
  }

  try {
    const order = await createOrderFromOg(og);
    await finishInboundEvent(event.id, { status: 'ok', orderId: order.id });
    return xml(ogSuccessXml(order.id));
  } catch (e) {
    const code = e instanceof OgOrderError ? e.code : 'INTERNAL';
    const message = e instanceof Error ? e.message : 'Order could not be created';
    console.error(`[inbound:ordergroove] ${og.ogOrderId} ${code}: ${message}`);
    await finishInboundEvent(event.id, { status: 'error', error: `${code}: ${message}` });
    return xml(ogErrorXml(code, message), code === 'INTERNAL' ? 500 : 422);
  }
};

export const GET: APIRoute = () => xml(ogErrorXml('METHOD', 'POST the order XML to this endpoint'), 405);
