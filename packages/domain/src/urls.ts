/**
 * URL rules for the v2 site and for translating legacy FiltersFast.com URLs.
 *
 * Legacy shapes (see docs/legacy-inventory/01-customer-features.md §13):
 *   /<Slug>-cat.asp                 category (slug stored in categories.pagname)
 *   /p-<slug>.asp, /<Slug>.asp      product  (slug stored in products.pagename)
 *   /models/<modelnumber>           appliance model page
 *   /mobile/<anything>              m-dot duplicate of the above
 *   /HFC, /sitemap.html, ...        friendly aliases
 *
 * v2 canonical shapes:
 *   /c/<slug>   /p/<slug>   /models/<model>   /search?q=
 */

/** Lowercase, ASCII, hyphen-separated slug. Idempotent on already-clean slugs. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Legacy `pagename` values include the `.asp` suffix and mixed case; strip and normalise. */
export function legacySlugToV2(pagename: string): string {
  return slugify(pagename.replace(/\.asp$/i, ''));
}

export function productPath(slug: string): string {
  return `/p/${slug}`;
}

export function categoryPath(slug: string): string {
  return `/c/${slug}`;
}

export function modelPath(model: string): string {
  return `/models/${encodeURIComponent(model.trim())}`;
}

const STATIC_ALIASES: Record<string, string> = {
  '/default.asp': '/',
  '/hfc': '/home-filter-club',
  '/auto-delivery.asp': '/home-filter-club',
  '/myautodelivery.asp': '/account/subscriptions',
  '/sitemap.html': '/sitemap',
  '/sitemap.asp': '/sitemap',
  '/aboutus.asp': '/about-us',
  '/our-story.asp': '/our-story',
  '/our-mission.asp': '/our-mission',
  '/our-brand.asp': '/our-brand',
  '/reviews.asp': '/reviews',
  '/returns.asp': '/returns',
  '/trackorder.asp': '/track-order',
  '/termsandcond.asp': '/terms',
  '/cainfosharingdisclosure.asp': '/privacy/california',
  '/business-services.asp': '/business-services',
  '/modellookuphome.asp': '/models',
  '/refrigeratorfindertool.asp': '/tools/refrigerator-finder',
  '/p-filters-fast-custom-air-filters.asp': '/custom-air-filters',
  '/prodviewcustom.asp': '/custom-air-filters',
  '/cart.asp': '/cart',
  '/logon.asp': '/account/login',
  '/custlistorders.asp': '/account/orders',
  '/custmodels.asp': '/account/appliances',
  '/custedit.asp': '/account/settings',
  '/custpayments.asp': '/account/payment-methods',
  '/custreminders.asp': '/account/reminders',
  '/custsecurity.asp': '/account/security',
  '/search.asp': '/search',
  '/links.asp': '/links',
};

/** Legacy script names that are internal plumbing, never content; send them home. */
const LEGACY_PLUMBING = /^\/(\d\d_[a-z_-]+|_inc[a-z0-9_-]*|mobilecheck(cart)?|geoip|setlocale|sysmsg|json3|redirecthub|paymentcheck|vaultcheck|recaptcha|oauth|getsizes|getpoolsizes)\.asp$/i;

/**
 * Translate a legacy path to its v2 canonical. Returns null when the path is
 * already a v2 path (or unknown), so the caller can fall through to routing
 * or to the database redirect table.
 */
export function legacyPathToCanonical(pathname: string): string | null {
  let path = pathname;

  // m-dot tree collapses onto the desktop rules.
  if (/^\/mobile(\/|$)/i.test(path)) {
    path = path.replace(/^\/mobile/i, '') || '/';
    if (path === '/' || /^\/default\.asp$/i.test(path)) return '/';
    // Mobile-only script names map to their desktop twins.
    path = path
      .replace(/^\/prodlistmobile\.asp$/i, '/prodlist4.asp')
      .replace(/^\/prodviewmobile(v2)?\.asp$/i, '/prodviewhv2.asp');
    return legacyPathToCanonical(path) ?? path;
  }

  const lower = path.toLowerCase();

  const alias = STATIC_ALIASES[lower];
  if (alias) return alias;

  if (LEGACY_PLUMBING.test(path)) return '/';

  // /models/<model> is kept, but normalised (legacy allowed spaces / mixed case).
  const model = path.match(/^\/(?:models|modellookup)\/(.+)$/i);
  if (model?.[1]) {
    const decoded = safeDecode(model[1]).trim();
    return modelPath(decoded.toUpperCase());
  }

  // /promo/<CODE> stays.
  if (/^\/promo\/[^/]+$/i.test(path)) return null;

  // Category: anything ending in -cat.asp
  const cat = path.match(/^\/([^/]+)-cat\.asp$/i);
  if (cat?.[1]) return categoryPath(slugify(cat[1]));

  // Product: /p-foo.asp, /pg1-foo.asp, or any other top-level *.asp we have not claimed.
  const prod = path.match(/^\/(?:p-|pg1-)?([^/]+)\.asp$/i);
  if (prod?.[1]) return productPath(slugify(prod[1]));

  // /filters/<kw> and /nav/<kw> were keyword redirects → hand to search.
  const kw = path.match(/^\/(?:filters|nav|popular)\/(.+)$/i);
  if (kw?.[1]) return `/search?q=${encodeURIComponent(safeDecode(kw[1]))}`;

  return null;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
