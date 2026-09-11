import type { APIRoute } from 'astro';
import { cachedXml, countModels, countProducts, MODELS_PER_FILE, PRODUCTS_PER_FILE, sitemapindex } from '~/lib/sitemaps';

export const GET: APIRoute = ({ request, site }) =>
  cachedXml(request, async () => {
    const origin = (site ?? new URL(request.url)).origin;
    const [products, models] = await Promise.all([countProducts(), countModels()]);
    const files = ['/sitemap-pages.xml', '/sitemap-categories.xml'];
    for (let i = 1; i <= Math.ceil(products / PRODUCTS_PER_FILE); i++) files.push(`/sitemap-products-${i}.xml`);
    for (let i = 1; i <= Math.ceil(models / MODELS_PER_FILE); i++) files.push(`/sitemap-models-${i}.xml`);
    return sitemapindex(files.map((f) => origin + f));
  });
