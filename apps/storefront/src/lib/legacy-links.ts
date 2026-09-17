/** Links to legacy `<Name>-cat.asp` paths become /c/<slug> (same rule as lib/redirects.ts). */
export const legacyCat = (legacy: string) => `/c/${legacy.replace(/-cat\.asp$/i, '').toLowerCase()}`;
export const searchFor = (q: string) => `/search?q=${encodeURIComponent(q)}`;
/**
 * The live site's /images folder, served from R2 under `legacy/` (scripts/upload-legacy-images.mjs).
 * Hot-linking www.filtersfast.com fails in browsers: its bot challenge answers cross-site image
 * requests with a 403. File names keep the legacy casing; the /images route lower-cases the lookup.
 */
export const LEGACY_IMG = '/images/legacy';
