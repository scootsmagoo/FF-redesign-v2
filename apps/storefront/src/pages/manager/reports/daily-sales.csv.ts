import type { APIRoute } from 'astro';
import { can } from '~/lib/manager/permissions';
import { DAILY_COLUMNS, DAILY_TYPES, dailySales, today, type DailyColumn, type DailyType } from '~/lib/manager/reports';
import { csvResponse, toCsv } from '~/lib/manager/util';

export const prerender = false;

/** Daily sales as CSV with the same column choice as the page (legacy sa_daily_sales export). */
export const GET: APIRoute = async ({ url, locals }) => {
  if (!can(locals.admin, 'Statistics', 0)) return new Response('Forbidden', { status: 403 });
  const sp = url.searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.get('date') ?? '') ? sp.get('date')! : today();
  const type = (DAILY_TYPES.includes(sp.get('type') as DailyType) ? sp.get('type') : 'filtersfast') as DailyType;
  const chosen = new Set(sp.getAll('col') as DailyColumn[]);
  const cols = DAILY_COLUMNS.filter(([k]) => chosen.size === 0 || chosen.has(k));
  const { rows } = await dailySales(date, type);
  const d = (c: number) => (c / 100).toFixed(2);
  const val = (r: (typeof rows)[number], c: DailyColumn): string | number => {
    switch (c) {
      case 'number': return r.number;
      case 'customer': return r.name.trim() || r.email;
      case 'placedAt': return r.placedAt;
      case 'source': return r.source;
      case 'promoCodes': return r.promoCodes ?? '';
      case 'currency': return r.currency;
      case 'payment': return r.paymentProvider ?? '';
      case 'salesCode': return r.salesCode ?? '';
      case 'subtotal': return d(r.subtotalCents);
      case 'shipping': return d(r.shippingCents);
      case 'tax': return d(r.taxCents);
      case 'donation': return d(r.donationCents);
      case 'discount': return d(r.discountCents);
      case 'total': return d(r.totalCents);
      case 'valid': return r.valid ? 'Y' : 'N';
      case 'status': return r.status;
      case 'reorder': return r.priorOrders > 0 ? 'Y' : 'N';
      case 'subscription': return r.subscription ? 'Y' : 'N';
    }
  };
  return csvResponse(`daily-sales-${type}-${date}.csv`, toCsv(cols.map(([, l]) => l), rows.map((r) => cols.map(([k]) => val(r, k)))));
};
