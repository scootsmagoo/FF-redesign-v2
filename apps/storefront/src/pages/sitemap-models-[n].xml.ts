import type { APIRoute } from 'astro';
import { cachedXml, modelNumbers, urlset } from '~/lib/sitemaps';

export const GET: APIRoute = ({ request, site, params }) =>
  cachedXml(request, async () => {
    const n = Number(params.n);
    if (!Number.isInteger(n) || n < 1 || n > 100) return null;
    const origin = (site ?? new URL(request.url)).origin;
    const numbers = await modelNumbers(n);
    if (!numbers.length) return null;
    return urlset(numbers.map((m) => ({ loc: `${origin}/models/${encodeURIComponent(m)}`, changefreq: 'monthly', priority: 0.5 })));
  });
