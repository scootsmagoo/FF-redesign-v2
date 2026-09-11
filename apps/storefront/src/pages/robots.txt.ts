import type { APIRoute } from 'astro';

/**
 * robots.txt. Only the canonical host (astro.config `site`) is crawlable; any other
 * hostname (the workers.dev staging URL, previews) is blocked outright so a copy of the
 * catalog never gets indexed under the wrong domain.
 */
export const GET: APIRoute = ({ request, site }) => {
  const host = new URL(request.url).host;
  const canonical = site?.host ?? host;
  const body =
    host !== canonical
      ? `# ${host} is not the canonical site (${canonical}); nothing here should be indexed.\nUser-agent: *\nDisallow: /\n`
      : [
          'User-agent: *',
          'Disallow: /cart',
          'Disallow: /checkout',
          'Disallow: /account',
          'Disallow: /manager',
          'Disallow: /search',
          'Disallow: /api/',
          'Disallow: /_actions/',
          'Disallow: /promo/',
          'Disallow: /track-order',
          '',
          `Sitemap: ${site!.origin}/sitemap-index.xml`,
          'Sitemap: https://blog.filtersfast.com/blog/sitemap_index.xml',
          '',
        ].join('\n');
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
};
