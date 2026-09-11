import type { APIRoute } from 'astro';
import { EXPORT_COLUMNS, exportCell, exportProducts, type ExportColumn } from '~/lib/manager/bulk';
import { can } from '~/lib/manager/permissions';
import { csvResponse, toCsv } from '~/lib/manager/util';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  if (!can(locals.admin, 'Products', 1)) return new Response('Forbidden', { status: 403 });
  const sp = url.searchParams;
  const chosen = sp.getAll('col') as ExportColumn[];
  const cols = EXPORT_COLUMNS.filter(([k]) => chosen.length === 0 || chosen.includes(k));
  const rows = await exportProducts({ q: sp.get('q') ?? '', searchDetails: sp.get('details') === '1', includeInactive: sp.get('inactive') === '1' });
  return csvResponse(`products-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(cols.map(([, l]) => l), rows.map((r) => cols.map(([k]) => exportCell(r, k)))));
};
