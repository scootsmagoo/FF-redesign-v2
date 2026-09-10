import { legacyPathToCanonical } from '@ff/domain/urls';

export interface Redirect {
  to: string;
  status: 301 | 302 | 308;
  keepQuery?: boolean;
}

/**
 * Resolves a legacy FiltersFast URL to its v2 canonical.
 *
 * Phase 0: pure pattern rules from @ff/domain (`*-cat.asp` → `/c/{slug}`,
 * `*.asp` product pages → `/p/{slug}`, `/mobile/*` → desktop equivalent).
 * Phase 1 adds a D1 `redirects` table lookup (prodRedirect / catRedirect /
 * redirectHub / keyword redirects) behind this same function.
 */
export async function resolveLegacyRedirect(pathname: string): Promise<Redirect | null> {
  const canonical = legacyPathToCanonical(pathname);
  if (canonical && canonical !== pathname) {
    return { to: canonical, status: 301, keepQuery: true };
  }
  return null;
}
