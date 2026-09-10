import { defineMiddleware } from 'astro:middleware';
import { getAuth } from '~/lib/auth';
import { getAdminFromToken, MANAGER_COOKIE } from '~/lib/manager-auth';
import { resolveLegacyRedirect } from '~/lib/redirects';

const STATIC = /^\/(_astro|brand|favicon|robots\.txt|api\/auth)/;
const MANAGER_LOGIN = '/manager/login';
/** Pages an admin who must change their password may still reach. */
const MANAGER_ALWAYS = new Set(['/manager/account', '/manager/logout', MANAGER_LOGIN]);

/**
 * Request pipeline:
 *  1. Legacy URL redirects (.asp product/category URLs, /mobile/* tree, redirectHub keywords).
 *  2. Geo defaults from Cloudflare headers (country drives currency/shipping copy).
 *  3. /manager/*: back-office session (own cookie + table); customers are never recognised here.
 *  4. Everything else: customer session lookup (Better Auth) → locals.user / locals.session.
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
  context.locals.admin = null;

  if (pathname === '/manager' || pathname.startsWith('/manager/')) {
    const token = context.cookies.get(MANAGER_COOKIE)?.value;
    if (token) context.locals.admin = await getAdminFromToken(token);
    if (!context.locals.admin) {
      if (pathname === MANAGER_LOGIN) return next();
      const returnUrl = pathname === '/manager' ? '' : `?returnUrl=${encodeURIComponent(pathname + search)}`;
      return context.redirect(MANAGER_LOGIN + returnUrl, 302);
    }
    if (context.locals.admin.mustChangePassword && !MANAGER_ALWAYS.has(pathname)) {
      return context.redirect('/manager/account?must=1', 302);
    }
    return next();
  }

  if (!STATIC.test(pathname) && context.request.headers.get('cookie')?.includes('ff.')) {
    try {
      const s = await getAuth().api.getSession({ headers: context.request.headers });
      if (s) {
        const u = s.user as { customerId?: number | null };
        context.locals.user = { id: s.user.id, email: s.user.email, name: s.user.name, customerId: u.customerId ?? null };
        context.locals.session = { id: s.session.id, expiresAt: s.session.expiresAt };
      }
    } catch {
      /* treat as signed out */
    }
  }

  return next();
});
