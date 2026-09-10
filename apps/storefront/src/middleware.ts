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
        const u = s.user as { customerId?: number | null; role?: string };
        context.locals.user = { id: s.user.id, email: s.user.email, name: s.user.name, customerId: u.customerId ?? null, role: u.role === 'admin' ? 'admin' : 'customer' };
        context.locals.session = { id: s.session.id, expiresAt: s.session.expiresAt };
      }
    } catch {
      /* treat as signed out */
    }
  }

  // Back office: signed-in admins only. Customers get a 403 rather than a redirect loop.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!context.locals.user) return context.redirect(`/account/login?next=${encodeURIComponent(pathname + search)}`, 302);
    if (context.locals.user.role !== 'admin') return new Response('Forbidden', { status: 403, headers: { 'content-type': 'text/plain' } });
  }

  return next();
});
