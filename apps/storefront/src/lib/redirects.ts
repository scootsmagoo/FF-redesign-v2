import { eq, sql } from 'drizzle-orm';
import { redirects } from '@ff/db';
import { legacyPathToCanonical } from '@ff/domain/urls';
import { getDb } from './db';

export interface Redirect {
  to: string;
  status: 301 | 302 | 308;
  keepQuery?: boolean;
}

const V2_PREFIX = /^\/(p|c|models|search|cart|checkout|account|manager|track-order|promo|_astro|brand|api|_actions)(\/|$)/;

/**
 * Resolves a legacy FiltersFast URL to its v2 canonical.
 *
 *  1. Exact match in the `redirects` table (legacy prodRedirect / catRedirect /
 *     redirectHub rows plus manual entries). Wins over pattern rules because a
 *     renamed product's old pagename must land on the *new* product.
 *  2. Pattern rules from @ff/domain (`*-cat.asp` → `/c/{slug}`, `*.asp` → `/p/{slug}`,
 *     `/mobile/*` → desktop equivalent, friendly aliases).
 */
export async function resolveLegacyRedirect(pathname: string): Promise<Redirect | null> {
  if (pathname === '/' || V2_PREFIX.test(pathname) || pathname.includes('.') && !/\.asp$/i.test(pathname) && !/\.html?$/i.test(pathname)) {
    // v2 routes and static assets never need a lookup
    if (!/\.asp$/i.test(pathname) && !/\.html?$/i.test(pathname) && !/^\/mobile\//i.test(pathname)) return null;
  }

  const hit = await getDb()
    .select({ to: redirects.toPath, status: redirects.status })
    .from(redirects)
    .where(eq(sql`lower(${redirects.fromPath})`, pathname.toLowerCase()))
    .limit(1);
  if (hit[0]) return { to: hit[0].to, status: hit[0].status === 302 ? 302 : 301, keepQuery: true };

  const canonical = legacyPathToCanonical(pathname);
  if (canonical && canonical !== pathname) {
    return { to: canonical, status: 301, keepQuery: true };
  }
  return null;
}
