import type { APIRoute } from 'astro';
import { can } from '~/lib/manager/permissions';
import { purchasers } from '~/lib/manager/reports';
import { csvResponse, toCsv } from '~/lib/manager/util';

export const prerender = false;

/** Purchaser export CSV (legacy export_<sku>_results_<date>.csv). */
export const GET: APIRoute = async ({ url, locals }) => {
  if (!can(locals.admin, 'Products') || !can(locals.admin, 'Promotions')) return new Response('Forbidden', { status: 403 });
  const sp = url.searchParams;
  const skus = (sp.get('skus') ?? '').split(/[\s,;]+/).filter(Boolean);
  const statuses = sp.getAll('status');
  const since = [30, 365, 1460].includes(Number(sp.get('since'))) ? Number(sp.get('since')) : null;
  const rows = skus.length ? await purchasers(skus, statuses.length ? statuses : ['paid', 'processing', 'shipped', 'complete'], since) : [];
  const name = `export_${skus.slice(0, 3).join('-').replace(/[^A-Za-z0-9-]/g, '')}_results_${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(name, toCsv(['Customer ID', 'First Name', 'Last Name', 'Email', 'SKU', 'Orders', 'Last Order'], rows.map((r) => [r.customerId ?? '', r.firstName ?? '', r.lastName ?? '', r.email, r.sku, r.orders, r.lastOrder])));
};
