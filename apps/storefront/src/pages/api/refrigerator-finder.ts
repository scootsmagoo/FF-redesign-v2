import type { APIRoute } from 'astro';
import { finderBrands, finderLocations, finderRemovals, finderResult, finderStyles } from '~/lib/finder';

/**
 * JSON version of the refrigerator finder for third-party embeds (legacy refrigeratorFinderTool.asp
 * answered with `Access-Control-Allow-Origin: *`). Each call returns the next step's options:
 *   /api/refrigerator-finder                      → brands
 *   ?brand=524                                    → styles
 *   ?brand=524&style=2                            → locations
 *   ?brand=524&style=2&location=3                 → removal methods
 *   ?brand=524&style=2&location=3&removal=4       → products
 */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export const OPTIONS: APIRoute = () => new Response(null, { status: 204, headers: CORS });

export const GET: APIRoute = async ({ url, site }) => {
  const num = (k: string) => {
    const v = Number(url.searchParams.get(k));
    return Number.isInteger(v) && v > 0 ? v : null;
  };
  const brand = num('brand');
  const style = num('style');
  const location = num('location');
  const removal = num('removal');
  const origin = (site ?? url).origin;
  const page = (q: Record<string, number | null>) => `${origin}/tools/refrigerator-finder?${new URLSearchParams(Object.entries(q).filter(([, v]) => v).map(([k, v]) => [k, String(v)]))}`;

  let body: unknown;
  if (!brand) body = { step: 'brand', options: (await finderBrands()).map((b) => ({ id: b.id, name: b.name, href: page({ brand: b.id }) })) };
  else if (!style) body = { step: 'style', options: (await finderStyles(brand)).map((s) => ({ id: s.id, name: s.name, href: page({ brand, style: s.id }) })) };
  else if (!location) body = { step: 'location', options: (await finderLocations(brand, style)).map((l) => ({ id: l.id, name: l.name, href: page({ brand, style, location: l.id }) })) };
  else if (!removal) body = { step: 'removal', options: (await finderRemovals(brand, style, location)).map((r) => ({ id: r.id, name: r.name, href: page({ brand, style, location, removal: r.id }) })) };
  else {
    const r = await finderResult(brand, style, location, removal);
    body = { step: 'result', multiple: r.multiple, products: r.products.map((p) => ({ id: p.id, sku: p.sku, name: p.name, priceCents: p.priceCents, imageUrl: p.thumbUrl ?? p.imageUrl, href: `${origin}/p/${p.slug}` })) };
  }
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600', ...CORS } });
};
