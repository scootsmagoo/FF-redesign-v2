import type { APIRoute } from 'astro';
import { can } from '~/lib/manager/permissions';
import { sxsCsv, sxsExport, sxsFilename } from '~/lib/manager/sxs';
import { csvResponse } from '~/lib/manager/util';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  if (!can(locals.admin, 'Products', 1)) return new Response('Forbidden', { status: 403 });
  const sp = url.searchParams;
  const rows = await sxsExport({ rootIds: sp.getAll('root').map(Number).filter((n) => n > 0), includeInactive: sp.get('inactive') === '1', onlyWithChildren: sp.get('children') === '1' });
  return csvResponse(sxsFilename(), sxsCsv(rows));
};
