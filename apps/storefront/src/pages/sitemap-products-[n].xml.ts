import type { APIRoute } from 'astro';
import { cachedXml, productSlugs, urlset } from '~/lib/sitemaps';

export const GET: APIRoute = ({ request, site, params }) =>
  cachedXml(request, async () => {
    const n = Number(params.n);
    if (!Number.isInteger(n) || n < 1 || n > 100) return null;
    const origin = (site ?? new URL(request.url)).origin;
    const slugs = await productSlugs(n);
    if (!slugs.length) return null;
    return urlset(slugs.map((s) => ({ loc: `${origin}/p/${s}`, changefreq: 'weekly', priority: 0.8 })));
  });
