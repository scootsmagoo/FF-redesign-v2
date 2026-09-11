import { env } from 'cloudflare:workers';
import { sql } from 'drizzle-orm';
import { getDb } from '../db';
import { getProviders } from '../providers';
import { readSetting, writeSetting } from './config';

/**
 * Deployment health (legacy utilities hub: DB write test, DB structure check, email test,
 * server variables, sa_vault's "which secrets exist"). Secrets are reported as set / not set,
 * never by value.
 */

export class HealthError extends Error {}

const BINDINGS = ['DB', 'SESSION', 'CACHE', 'IMAGES', 'IMAGES_API', 'ASSETS'] as const;
const VARS = ['SITE_URL', 'PAYMENT_PROVIDER', 'EMAIL_PROVIDER', 'EMAIL_FROM', 'EMAIL_FROM_NAME', 'TAX_PROVIDER', 'SHIPPING_PROVIDER', 'ADDRESS_PROVIDER', 'FREE_SHIPPING_THRESHOLD', 'FREE_SHIPPING_THRESHOLD_VIP', 'ORDERGROOVE_API_USER', 'EMAIL_DEBUG_LINKS'] as const;
const SECRETS = ['BETTER_AUTH_SECRET', 'LEGACY_HASH_KEY', 'SENDGRID_API_KEY', 'SENDGRID_TEMPLATE_ORDER_CONFIRMATION', 'SENDGRID_TEMPLATE_SHIPMENT', 'SENDGRID_TEMPLATE_PASSWORD_RESET', 'ORDERGROOVE_API_PASSWORD', 'ORDERGROOVE_HASH_KEY', 'AUTOMATION_TOKEN', 'CLOUDFLARE_IMAGES_TOKEN', 'CYBERSOURCE_SHARED_SECRET', 'PAYPAL_CLIENT_SECRET', 'TAXJAR_API_KEY', 'UPS_CLIENT_SECRET', 'FEDEX_SECRET', 'USPS_KEY', 'SMARTY_AUTH_TOKEN', 'HAWKSEARCH_KEY', 'KLAVIYO_KEY', 'SIGNIFYD_KEY'] as const;

export async function healthReport(request: Request) {
  const e = env as unknown as Record<string, unknown>;
  const db = getDb();
  const bindings = BINDINGS.map((b) => ({ name: b, present: e[b] !== undefined && e[b] !== null }));
  const vars = VARS.map((v) => ({ name: v, value: typeof e[v] === 'string' ? (e[v] as string) : e[v] === undefined ? null : String(e[v]) }));
  const secrets = SECRETS.map((s) => ({ name: s, set: typeof e[s] === 'string' && (e[s] as string).length > 0 }));
  let migrations: { id: number; name: string; appliedAt: string }[] = [];
  let dbOk = true;
  let dbError: string | null = null;
  try {
    const rows = await db.all<{ id: number; name: string; applied_at: string }>(sql`select id, name, applied_at from d1_migrations order by id`);
    migrations = rows.map((r) => ({ id: r.id, name: r.name, appliedAt: r.applied_at }));
  } catch (err) {
    dbOk = false;
    dbError = err instanceof Error ? err.message : String(err);
  }
  let tables: string[] = [];
  try {
    tables = (await db.all<{ name: string }>(sql`select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '_cf_%' order by name`)).map((r) => r.name);
  } catch {
    /* reported through dbOk */
  }
  const p = getProviders();
  const providers = [
    ['Payment', p.payment.name],
    ['Email', p.email.name],
    ['Tax', p.tax.name],
    ['Shipping', p.shipping.name],
    ['Address', p.address.name],
  ] as const;
  const h = request.headers;
  const server = [
    ['Host', h.get('host')],
    ['Cloudflare ray', h.get('cf-ray')],
    ['Edge country', h.get('cf-ipcountry')],
    ['Client IP', h.get('cf-connecting-ip') ?? h.get('x-forwarded-for')],
    ['Protocol', h.get('x-forwarded-proto')],
    ['User agent', h.get('user-agent')],
    ['Time (UTC)', new Date().toISOString()],
  ] as const;
  const lastWrite = await readSetting<{ at: string; by: string } | null>('health.write_test', null);
  return { bindings, vars, secrets, migrations, tables, dbOk, dbError, providers, server, lastWrite };
}

/** Round-trips a row through `site_settings` (legacy utilities_DBwrite). */
export async function dbWriteTest(adminEmail: string): Promise<{ ok: true; at: string }> {
  const at = new Date().toISOString();
  await writeSetting('health.write_test', { at, by: adminEmail }, 'Last manager DB write test');
  const back = await readSetting<{ at: string } | null>('health.write_test', null);
  if (back?.at !== at) throw new HealthError('The row was written but read back differently.');
  return { ok: true, at };
}

/** Sends a plain test message through the configured email provider (legacy utilities_Email). */
export async function sendTestEmail(to: string, adminEmail: string): Promise<{ ok: true; messageId: string | null; provider: string }> {
  const p = getProviders().email;
  const r = await p.send({
    to: to.trim(),
    subject: 'FiltersFast.com Manager email test',
    html: `<p>This is a test message sent from the FiltersFast.com Manager by ${adminEmail} at ${new Date().toISOString()} using the <strong>${p.name}</strong> provider.</p>`,
    text: `Test message from the FiltersFast.com Manager by ${adminEmail} (${p.name}).`,
  });
  if (!r.ok) throw new HealthError(r.error ?? 'The provider refused the message.');
  return { ok: true, messageId: r.messageId ?? null, provider: p.name };
}
