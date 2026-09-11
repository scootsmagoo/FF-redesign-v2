import type { APIRoute } from 'astro';
import { listNewsletterRecipients, type Segment } from '~/lib/manager/marketing';
import { can } from '~/lib/manager/permissions';
import { csvResponse, toCsv } from '~/lib/manager/util';

export const prerender = false;

/** Mailing-list download (legacy SA_news_exec "Download" action): email, first name, last name. */
export const GET: APIRoute = async ({ url, locals }) => {
  if (!can(locals.admin, 'Newsletter', 0)) return new Response('Forbidden', { status: 403 });
  const segment = (['all', 'optin', 'optout'].includes(url.searchParams.get('segment') ?? '') ? url.searchParams.get('segment') : 'optin') as Segment;
  const paidOnly = url.searchParams.get('paid') === '1';
  const rows: unknown[][] = [];
  let after: string | null = null;
  for (let i = 0; i < 200; i++) {
    const batch = await listNewsletterRecipients(segment, paidOnly, after, 1000);
    for (const r of batch) rows.push([r.email, r.firstName ?? '', r.lastName ?? '']);
    if (batch.length < 1000) break;
    after = batch[batch.length - 1]!.email;
  }
  return csvResponse(`mailing-list-${segment}${paidOnly ? '-paid' : ''}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(['email', 'first_name', 'last_name'], rows));
};
