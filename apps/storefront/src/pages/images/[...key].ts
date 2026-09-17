import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { contentTypeFor } from '~/lib/manager/images';

export const prerender = false;

/**
 * Serves files from the IMAGES R2 bucket: /images/products/foo.jpg → key "products/foo.jpg".
 * /images/legacy/Foo.JPG → key "legacy/foo.jpg" (the old site's /images folder, see lib/legacy-links.ts).
 * `?w=400` (and optional `&f=webp|avif|jpeg`) resizes through the Cloudflare Images binding when
 * it is available; otherwise the original is returned. Responses are immutable-cached at the edge.
 */
type Bindings = { IMAGES?: R2Bucket; IMAGES_API?: { input(body: ReadableStream): { transform(o: { width?: number; height?: number; fit?: string }): { output(o: { format: string; quality?: number }): Promise<{ response(): Response }> } } } };

export const GET: APIRoute = async ({ params, url, request }) => {
  const raw = (params.key ?? '').replace(/^\/+/, '');
  // legacy/ holds the old IIS /images folder, whose paths were case-insensitive: keys are stored lower-case
  const key = /^legacy\//i.test(raw) ? raw.toLowerCase() : raw;
  const b = (env as unknown as Bindings).IMAGES;
  if (!key || key.includes('..') || !b) return new Response('Not found', { status: 404 });

  const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
  const cacheKey = new Request(url.toString(), { method: 'GET' });
  const hit = cache ? await cache.match(cacheKey) : undefined;
  if (hit) return hit;

  // imported legacy HTML (category copy, support articles) still says /images/foo.jpg
  const obj = (await b.get(key)) ?? (key.startsWith('legacy/') ? null : await b.get(`legacy/${key.toLowerCase()}`));
  if (!obj) return new Response('Not found', { status: 404 });
  const etag = obj.httpEtag;
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { ETag: etag } });

  const headers = new Headers({ 'Content-Type': obj.httpMetadata?.contentType ?? contentTypeFor(key), 'Cache-Control': 'public, max-age=31536000, immutable', ETag: etag });
  let res: Response;

  const w = Number(url.searchParams.get('w'));
  const api = (env as unknown as Bindings).IMAGES_API;
  const format = url.searchParams.get('f') ?? 'webp';
  if (api && Number.isInteger(w) && w > 0 && w <= 2000 && /^image\/(jpeg|png|webp|gif|avif)$/.test(headers.get('Content-Type') ?? '')) {
    try {
      const out = await api.input(obj.body).transform({ width: w, fit: 'scale-down' }).output({ format: `image/${format === 'jpg' ? 'jpeg' : format}`, quality: 82 });
      const r = out.response();
      res = new Response(r.body, { headers: { ...Object.fromEntries(r.headers), 'Cache-Control': 'public, max-age=31536000, immutable', ETag: `${etag}-w${w}-${format}` } });
    } catch {
      res = new Response(obj.body, { headers });
    }
  } else {
    res = new Response(obj.body, { headers });
  }
  if (cache) await cache.put(cacheKey, res.clone()).catch(() => {});
  return res;
};
