import type { APIRoute } from 'astro';
import { THEME_COOKIE } from '~/lib/manager/theme';

const YEAR = 60 * 60 * 24 * 365;

/** POST theme=light|dark|system, returnTo=/manager/... — the header toggle's no-JavaScript path. */
export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const form = await request.formData();
  const theme = String(form.get('theme') ?? '');
  const back = String(form.get('returnTo') ?? '/manager');
  const returnTo = back.startsWith('/manager') && !back.startsWith('//') ? back : '/manager';
  if (theme === 'light' || theme === 'dark') cookies.set(THEME_COOKIE, theme, { path: '/manager', maxAge: YEAR, sameSite: 'lax', httpOnly: false, secure: url.protocol === 'https:' });
  else cookies.delete(THEME_COOKIE, { path: '/manager' });
  return redirect(returnTo, 303);
};
