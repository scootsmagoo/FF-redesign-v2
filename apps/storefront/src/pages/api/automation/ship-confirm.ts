import type { APIRoute } from 'astro';
import { automationTokenOk, clientIp, finishInboundEvent, recordInboundEvent, shipConfirm } from '~/lib/inbound';

export const prerender = false;

/**
 * WMS ship confirmation (legacy `automation/shipconfirm.asp` / `shipconfirm2.asp`): the warehouse
 * calls this with `idorder` + `tracking` (+ optional `carrier`, `station`, `notify=0`). Records the
 * shipment, moves the order to shipped and emails the customer the tracking number.
 * Auth: `Authorization: Bearer <AUTOMATION_TOKEN>` or `?token=` for GET-only callers.
 * Idempotent on (order, tracking): a repeat call answers with the first result.
 */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

async function handle(request: Request, url: URL, params: URLSearchParams) {
  if (!automationTokenOk(request, url)) return json({ ok: false, error: 'Unauthorized' }, 401);
  const orderRef = (params.get('idorder') ?? params.get('order') ?? '').trim();
  const trackingNumber = (params.get('tracking') ?? params.get('trackingNumber') ?? '').trim();
  if (!orderRef || !trackingNumber) return json({ ok: false, error: 'idorder and tracking are required' }, 400);
  const carrier = params.get('carrier');
  const station = params.get('station');
  const notify = !['0', 'false', 'no', 'N'].includes(params.get('notify') ?? '');

  // "16133" and "L16133" name the same legacy order; key the event on the normalized reference.
  const externalId = `${orderRef.toUpperCase().replace(/^L(?=\d+$)/, '')}:${trackingNumber.replace(/\s+/g, '')}`;
  const { event, duplicate } = await recordInboundEvent('wms', externalId, params.toString(), clientIp(request));
  if (duplicate) {
    return event.status === 'ok' ? json({ ok: true, duplicate: true, orderId: event.orderId }) : json({ ok: false, duplicate: true, error: event.error ?? 'earlier attempt failed' }, event.status === 'error' ? 422 : 409);
  }
  try {
    const r = await shipConfirm({ orderRef, trackingNumber, carrier, station, notify });
    await finishInboundEvent(event.id, { status: 'ok', orderId: r.orderId });
    return json({ ok: true, orderId: r.orderId, number: r.number, shipmentId: r.shipmentId, emailed: r.emailed });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Ship confirmation failed';
    console.error(`[inbound:wms] ${externalId}: ${message}`);
    await finishInboundEvent(event.id, { status: 'error', error: message });
    return json({ ok: false, error: message }, /not found/i.test(message) ? 404 : 422);
  }
}

export const GET: APIRoute = ({ request, url }) => handle(request, url, url.searchParams);

export const POST: APIRoute = async ({ request, url }) => {
  const type = request.headers.get('content-type') ?? '';
  let params: URLSearchParams;
  if (type.includes('json')) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    params = new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v ?? '')]));
  } else {
    params = new URLSearchParams(await request.text());
  }
  for (const [k, v] of url.searchParams) if (!params.has(k)) params.set(k, v);
  return handle(request, url, params);
};
