import type { APIRoute } from 'astro';
import { cachedXml, categorySlugs, urlset } from '~/lib/sitemaps';

export const GET: APIRoute = ({ request, site }) =>
  cachedXml(request, async () => {
    const origin = (site ?? new URL(request.url)).origin;
    const slugs = await categorySlugs();
    return urlset(slugs.map((s) => ({ loc: `${origin}/c/${s}`, changefreq: 'weekly', priority: 0.7 })));
  });
