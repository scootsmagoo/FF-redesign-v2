import type { APIRoute } from 'astro';
import { ogAuthCookieValue } from '@ff/domain/ordergroove';
import { ordergrooveHashKey } from '~/lib/inbound';

export const prerender = false;

/**
 * Sets Ordergroove's `og_auth` cookie for the signed-in customer (legacy `ogMsiAuth.asp`), so the
 * Ordergroove offer / Manage Subscriptions widgets recognise them. Needs ORDERGROOVE_HASH_KEY;
 * without it, or without a signed-in customer, the cookie is cleared. Two-hour lifetime as before.
 * The Home Filter Club page calls this before embedding the widgets (P3 once the OG ids exist).
 */
export const GET: APIRoute = async ({ locals, cookies, url }) => {
  const key = ordergrooveHashKey();
  const customerId = locals.user?.customerId ?? null;
  const secure = url.protocol === 'https:';
  if (!key || !customerId) {
    cookies.delete('og_auth', { path: '/' });
    return new Response(JSON.stringify({ ok: false, reason: !key ? 'not configured' : 'not signed in' }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
  const value = await ogAuthCookieValue(customerId, key);
  cookies.set('og_auth', value, { path: '/', maxAge: 60 * 120, secure, sameSite: 'lax', httpOnly: false });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};
