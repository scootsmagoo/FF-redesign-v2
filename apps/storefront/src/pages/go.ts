import type { APIRoute } from 'astro';

/** Target of the homepage "Search by brand" selects: `?to=/c/…` → 302 (same-site paths only). */
export const GET: APIRoute = ({ url, redirect }) => {
  const to = url.searchParams.get('to') ?? '/';
  return redirect(to.startsWith('/') && !to.startsWith('//') && !to.startsWith('/\\') ? to : '/', 302);
};
