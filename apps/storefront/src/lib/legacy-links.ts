/** Links to legacy `<Name>-cat.asp` paths become /c/<slug> (same rule as lib/redirects.ts). */
export const legacyCat = (legacy: string) => `/c/${legacy.replace(/-cat\.asp$/i, '').toLowerCase()}`;
export const searchFor = (q: string) => `/search?q=${encodeURIComponent(q)}`;
/** Live-site image folder, hot-linked until the assets move to R2 (roadmap P2 #12). */
export const LEGACY_IMG = 'https://www.filtersfast.com/images';
