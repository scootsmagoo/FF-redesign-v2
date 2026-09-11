import type { APIRoute } from 'astro';
import { ogPriceJson, parseOgPriceRequest } from '@ff/domain/ordergroove';
import { ogUnitPriceCents } from '~/lib/inbound';

export const prerender = false;

/**
 * Ordergroove price lookup (legacy `ogPriceApi.asp`): the offer widget posts
 * `json={"item":{"product":"1381-747","quantity":1}}` and reads `{"price":"67.45"}`.
 * Public, like the legacy page (prices are public), so it also answers GET `?product=…&quantity=…`.
 */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (body: string, status = 200) => new Response(body, { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export const OPTIONS: APIRoute = () => new Response(null, { status: 204, headers: CORS });

async function handle(input: string | Record<string, unknown> | null) {
  const req = parseOgPriceRequest(input);
  if (!req) return json('{}', 400);
  const cents = await ogUnitPriceCents(req.productId, req.optionId, req.quantity);
  if (cents === null || cents <= 0) return json('{}', 404);
  return json(ogPriceJson(cents));
}

export const POST: APIRoute = async ({ request }) => {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('json')) return handle((await request.json().catch(() => null)) as Record<string, unknown> | null);
  return handle(await request.text());
};

export const GET: APIRoute = ({ url }) => handle({ item: { product: url.searchParams.get('product') ?? '', quantity: url.searchParams.get('quantity') ?? '1' } });
