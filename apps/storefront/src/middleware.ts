import { defineMiddleware } from 'astro:middleware';
import { getAuth } from '~/lib/auth';
import { resolveLegacyRedirect } from '~/lib/redirects';

const STATIC = /^\/(_astro|brand|favicon|robots\.txt|api\/auth)/;

/**
 * Request pipeline:
 *  1. Legacy URL redirects (.asp product/category URLs, /mobile/* tree, redirectHub keywords).
 *  2. Geo defaults from Cloudflare headers (country drives currency/shipping copy).
 *  3. Session lookup (Better Auth) → locals.user / locals.session for pages.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;

  if (!STATIC.test(pathname)) {
    const redirect = await resolveLegacyRedirect(pathname);
    if (redirect) {
      return context.redirect(redirect.to + (redirect.keepQuery ? search : ''), redirect.status);
    }
  }

  context.locals.geo = {
    country: context.request.headers.get('cf-ipcountry') ?? 'US',
    region: context.request.headers.get('cf-region-code') ?? undefined,
    city: context.request.headers.get('cf-ipcity') ?? undefined,
  };

  context.locals.user = null;
  context.locals.session = null;
  if (!STATIC.test(pathname) && context.request.headers.get('cookie')?.includes('ff.')) {
    try {
      const s = await getAuth().api.getSession({ headers: context.request.headers });
      if (s) {
        context.locals.user = { id: s.user.id, email: s.user.email, name: s.user.name, customerId: (s.user as { customerId?: number | null }).customerId ?? null };
        context.locals.session = { id: s.session.id, expiresAt: s.session.expiresAt };
      }
    } catch {
      /* treat as signed out */
    }
  }

  return next();
});
