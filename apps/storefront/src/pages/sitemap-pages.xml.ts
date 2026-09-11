import type { APIRoute } from 'astro';
import { cachedXml, staticPaths, urlset } from '~/lib/sitemaps';

export const GET: APIRoute = ({ request, site }) =>
  cachedXml(request, async () => {
    const origin = (site ?? new URL(request.url)).origin;
    return urlset((await staticPaths()).map((p) => ({ loc: origin + p, changefreq: p === '/' ? 'daily' : 'weekly', priority: p === '/' ? 1 : 0.6 })));
  });
