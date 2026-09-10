import { defineMiddleware } from 'astro:middleware';
import { resolveLegacyRedirect } from '~/lib/redirects';

/**
 * Request pipeline:
 *  1. Legacy URL redirects (.asp product/category URLs, /mobile/* tree, redirectHub keywords).
 *  2. Geo defaults from Cloudflare headers (country drives currency/shipping copy).
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;

  const redirect = await resolveLegacyRedirect(pathname);
  if (redirect) {
    return context.redirect(redirect.to + (redirect.keepQuery ? search : ''), redirect.status);
  }

  context.locals.geo = {
    country: context.request.headers.get('cf-ipcountry') ?? 'US',
    region: context.request.headers.get('cf-region-code') ?? undefined,
    city: context.request.headers.get('cf-ipcity') ?? undefined,
  };

  return next();
});
