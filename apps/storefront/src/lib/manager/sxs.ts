import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { categories, compatibleSkus, products } from '@ff/db';
import { getDb } from '../db';
import { siteUrl } from '../emails';
import { getProviders } from '../providers';
import { toCsv } from './util';

/**
 * SxS page export (legacy SA_SxSExport.asp): every OEM product that has a compare-to product,
 * within the chosen category verticals, with the compatible item, its hub (paired parent) and
 * the hub's children. 18 columns, UTF-8 BOM CSV, optional email to a staff address.
 */

export class SxsError extends Error {}

export const SXS_COLUMNS = ['OEM ID', 'OEM SKU', 'OEM Name', 'OEM URL', 'Compatible ID', 'Compatible SKU', 'Compatible Name', 'Compatible Hub ID', 'Compatible Hub SKU', 'Compatible URL', 'Child Count', 'Child IDs', 'Child SKUs', 'Child Names', 'OEM Parts Count', 'Compatible Hub Parts Count', 'Compare Sort Order', 'OEM Active'] as const;

export interface SxsFilter {
  rootIds: number[];
  includeInactive: boolean;
  onlyWithChildren: boolean;
}

/** Vertical categories (legacy hard-coded water / air / refrigerator / pool & spa roots). */
export async function listSxsRoots() {
  const db = getDb();
  const cols = { id: categories.id, name: categories.name, slug: categories.slug, active: categories.active };
  const roots = await db.select(cols).from(categories).where(isNull(categories.parentId)).orderBy(asc(categories.sortOrder), asc(categories.name));
  // The legacy tree has one synthetic root ("Parent Categories"); the verticals are its children.
  if (roots.length === 1) return db.select(cols).from(categories).where(eq(categories.parentId, roots[0]!.id)).orderBy(asc(categories.sortOrder), asc(categories.name));
  return roots;
}

/** Roots preselected when the form first loads: names the legacy tool hard-coded. */
export function defaultRoots(roots: { id: number; name: string }[]): number[] {
  const wanted = /water|air|refrigerator|fridge|pool|spa/i;
  const hit = roots.filter((r) => wanted.test(r.name)).map((r) => r.id);
  return hit.length ? hit : roots.map((r) => r.id);
}

const chunk = <T>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export async function sxsExport(f: SxsFilter) {
  const db = getDb();
  const roots = f.rootIds.slice(0, 200);
  if (!roots.length) return [];
  const base = siteUrl();
  // Category subtree in JS (a few hundred rows) rather than a recursive CTE evaluated per product row.
  const tree = await db.select({ id: categories.id, parentId: categories.parentId }).from(categories);
  const byParent = new Map<number | null, number[]>();
  for (const c of tree) (byParent.get(c.parentId) ?? byParent.set(c.parentId, []).get(c.parentId)!).push(c.id);
  const inTree = new Set<number>();
  const stack = [...roots];
  while (stack.length) {
    const id = stack.pop()!;
    if (inTree.has(id)) continue;
    inTree.add(id);
    stack.push(...(byParent.get(id) ?? []));
  }
  // Literal integer list: validated ids, and far more than D1's 100 bound parameters would allow.
  const treeList = sql.raw([...inTree].map((n) => String(Math.trunc(n))).join(', ') || '0');
  const oem = await db
    .select({ oemId: products.id, oemSku: products.sku, oemName: products.name, oemSlug: products.slug, oemActive: products.active, compareSortOrder: products.compareSortOrder, compatibleId: products.compareToId })
    .from(products)
    .where(and(sql`${products.compareToId} > 0`, sql`${products.compareSortOrder} in (1, 2)`, f.includeInactive ? undefined : eq(products.active, true), sql`exists (select 1 from category_products cp where cp.product_id = ${products.id} and cp.category_id in (${treeList}))`))
    .orderBy(asc(products.sku))
    .limit(10000);

  const compatIds = [...new Set(oem.map((r) => r.compatibleId).filter((n): n is number => typeof n === 'number' && n > 0))];
  const compat = new Map<number, { id: number; sku: string; name: string; slug: string; parentProductId: number | null }>();
  for (const part of chunk(compatIds, 90)) for (const r of await db.select({ id: products.id, sku: products.sku, name: products.name, slug: products.slug, parentProductId: products.parentProductId }).from(products).where(inArray(products.id, part))) compat.set(r.id, r);

  const hubIds = [...new Set([...compat.values()].map((c) => c.parentProductId ?? c.id))];
  const hubs = new Map<number, string>();
  const children = new Map<number, { id: number; sku: string; name: string }[]>();
  for (const part of chunk(hubIds, 90)) {
    for (const r of await db.select({ id: products.id, sku: products.sku }).from(products).where(inArray(products.id, part))) hubs.set(r.id, r.sku);
    for (const r of await db.select({ id: products.id, sku: products.sku, name: products.name, parentProductId: products.parentProductId }).from(products).where(inArray(products.parentProductId, part)).orderBy(asc(products.id))) {
      const pid = r.parentProductId!;
      (children.get(pid) ?? children.set(pid, []).get(pid)!).push({ id: r.id, sku: r.sku, name: r.name });
    }
  }

  const parts = new Map<number, number>();
  for (const part of chunk([...new Set([...oem.map((r) => r.oemId), ...hubIds])], 90)) {
    for (const r of await db.select({ productId: compatibleSkus.productId, n: sql<number>`count(*)` }).from(compatibleSkus).where(inArray(compatibleSkus.productId, part)).groupBy(compatibleSkus.productId)) parts.set(r.productId, r.n);
  }

  const rows = oem.map((r) => {
    const c = r.compatibleId ? compat.get(r.compatibleId) : undefined;
    const hubId = c ? (c.parentProductId ?? c.id) : null;
    const kids = hubId ? (children.get(hubId) ?? []) : [];
    return {
      ...r,
      oemUrl: `${base}/p/${r.oemSlug}`,
      compatibleSku: c?.sku ?? null,
      compatibleName: c?.name ?? null,
      compatibleUrl: c ? `${base}/p/${c.slug}` : '',
      hubId,
      hubSku: hubId ? (hubs.get(hubId) ?? null) : null,
      childCount: kids.length,
      childIds: kids.map((k) => k.id).join('; ') || null,
      childSkus: kids.map((k) => k.sku).join('; ') || null,
      childNames: kids.map((k) => k.name).join('; ') || null,
      oemParts: parts.get(r.oemId) ?? 0,
      hubParts: hubId ? (parts.get(hubId) ?? 0) : 0,
    };
  });
  return f.onlyWithChildren ? rows.filter((r) => r.childCount > 0) : rows;
}

export type SxsRow = Awaited<ReturnType<typeof sxsExport>>[number];

export function sxsCsv(rows: SxsRow[]): string {
  const body = toCsv([...SXS_COLUMNS], rows.map((r) => [r.oemId, r.oemSku, r.oemName, r.oemUrl, r.compatibleId, r.compatibleSku ?? '', r.compatibleName ?? '', r.hubId ?? '', r.hubSku ?? '', r.compatibleUrl, r.childCount, r.childIds ?? '', r.childSkus ?? '', r.childNames ?? '', r.oemParts, r.hubParts, r.compareSortOrder, r.oemActive ? 'Y' : 'N']));
  return '﻿' + body;
}

export function sxsFilename(): string {
  return `sxs_export_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Emails the CSV as an attachment; staff addresses only, like the legacy tool. */
export async function emailSxsExport(to: string, f: SxsFilter, fromEmail: string): Promise<{ rows: number }> {
  const addr = to.trim().toLowerCase();
  if (!/^[^@\s]+@filtersfast\.com$/.test(addr)) throw new SxsError('The export can only be emailed to an @filtersfast.com address.');
  const rows = await sxsExport(f);
  const filename = sxsFilename();
  const r = await getProviders().email.send({
    to: addr,
    subject: `SxS page export (${rows.length} rows)`,
    html: `<p>Attached is the side-by-side page export requested by ${fromEmail}: ${rows.length} OEM products with a compare-to item.</p>`,
    text: `Attached is the side-by-side page export requested by ${fromEmail}: ${rows.length} rows.`,
    replyTo: fromEmail,
    attachments: [{ filename, content: toBase64(sxsCsv(rows)), type: 'text/csv' }],
  });
  if (!r.ok) throw new SxsError(r.error ?? 'The email could not be sent.');
  return { rows: rows.length };
}
