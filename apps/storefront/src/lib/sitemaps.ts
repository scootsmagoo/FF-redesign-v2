import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { applianceModels, categories, products } from '@ff/db';
import { getDb } from './db';
import { listSizes, POPULAR_SIZES } from './sizes';

/**
 * XML sitemaps (replaces the legacy job-generated sitemap.xml).
 *
 *   /sitemap-index.xml          → pages, categories, products-N, models-N
 *   /sitemap-pages.xml          static and size landing pages
 *   /sitemap-categories.xml     active categories (hubs included: they are real pages)
 *   /sitemap-products-N.xml     listable products, PRODUCTS_PER_FILE each
 *   /sitemap-models-N.xml       appliance models with at least one product, not noindex
 *
 * URLs always use the canonical origin (Astro.site), never the request host. Responses are
 * cached at the edge for CACHE_SECONDS via the Cache API.
 */

export const PRODUCTS_PER_FILE = 10_000;
export const MODELS_PER_FILE = 25_000;
export const CACHE_SECONDS = 12 * 60 * 60;

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'daily' | 'weekly' | 'monthly';
  priority?: number;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function urlset(urls: SitemapUrl[]): string {
  const body = urls
    .map((u) => {
      let x = `<url><loc>${esc(u.loc)}</loc>`;
      if (u.lastmod) x += `<lastmod>${u.lastmod}</lastmod>`;
      if (u.changefreq) x += `<changefreq>${u.changefreq}</changefreq>`;
      if (u.priority !== undefined) x += `<priority>${u.priority.toFixed(1)}</priority>`;
      return x + '</url>';
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function sitemapindex(locs: string[]): string {
  const body = locs.map((l) => `<sitemap><loc>${esc(l)}</loc></sitemap>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

/** Same listing rule as the catalog: active, not hidden, not discontinued, not blocked. */
const listable = and(eq(products.active, true), eq(products.hidden, false), ne(products.stock, -250), sql`coalesce(${products.blockedReason}, '') = ''`);

export async function countProducts(): Promise<number> {
  const [r] = await getDb().select({ n: sql<number>`count(*)` }).from(products).where(listable);
  return r?.n ?? 0;
}

export async function productSlugs(page: number): Promise<string[]> {
  const rows = await getDb()
    .select({ slug: products.slug })
    .from(products)
    .where(listable)
    .orderBy(asc(products.id))
    .limit(PRODUCTS_PER_FILE)
    .offset((page - 1) * PRODUCTS_PER_FILE);
  return rows.map((r) => r.slug);
}

export async function categorySlugs(): Promise<string[]> {
  const rows = await getDb().select({ slug: categories.slug }).from(categories).where(and(eq(categories.active, true), sql`${categories.id} > 1`)).orderBy(asc(categories.id));
  return rows.map((r) => r.slug);
}

const modelIndexable = and(eq(applianceModels.noindex, false), sql`exists (select 1 from model_products mp where mp.model_id = ${applianceModels.id})`);

export async function countModels(): Promise<number> {
  const [r] = await getDb().select({ n: sql<number>`count(*)` }).from(applianceModels).where(modelIndexable);
  return r?.n ?? 0;
}

export async function modelNumbers(page: number): Promise<string[]> {
  const rows = await getDb()
    .select({ modelNumber: applianceModels.modelNumber })
    .from(applianceModels)
    .where(modelIndexable)
    .orderBy(asc(applianceModels.id))
    .limit(MODELS_PER_FILE)
    .offset((page - 1) * MODELS_PER_FILE);
  return rows.map((r) => r.modelNumber);
}

export async function staticPaths(): Promise<string[]> {
  const sizes = new Set([...POPULAR_SIZES, ...(await listSizes())]);
  return ['/', '/categories', ...[...sizes].map((s) => `/air-filters/size/${s}`)];
}

const XML_HEADERS = { 'content-type': 'application/xml; charset=utf-8', 'cache-control': `public, max-age=${CACHE_SECONDS}` };

/**
 * Runs `build` once per CACHE_SECONDS per edge location via the Cache API, falling back to a
 * plain response wherever `caches` is unavailable (unit tests, some local runners).
 */
export async function cachedXml(request: Request, build: () => Promise<string | null>): Promise<Response> {
  const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
  const key = new Request(request.url, { method: 'GET' });
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) return hit;
    } catch {
      /* cache unavailable */
    }
  }
  const xml = await build();
  if (xml === null) return new Response('Not found', { status: 404 });
  const res = new Response(xml, { headers: XML_HEADERS });
  if (cache) {
    try {
      await cache.put(key, res.clone());
    } catch {
      /* cache unavailable */
    }
  }
  return res;
}
