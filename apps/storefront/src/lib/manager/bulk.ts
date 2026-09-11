import { and, asc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { products } from '@ff/db';
import { getDb } from '../db';
import { siteUrl } from '../emails';
import { toBool, toInt } from './util';

/**
 * Bulk product updater (legacy sa_prod_bulk.asp, which generated and executed raw UPDATE SQL)
 * and product export (legacy sa_prod_export.asp). The updater previews what would change, then
 * applies one of three operations to a list of product ids: text find/replace across chosen
 * fields, set the main image, or set the paired parent.
 */

export class BulkError extends Error {}

export const BULK_TEXT_FIELDS = {
  name: { label: 'Title', col: products.name },
  shortDescription: { label: 'Short description', col: products.shortDescription },
  descriptionHtml: { label: 'Details (HTML)', col: products.descriptionHtml },
  metaTitle: { label: 'Meta title', col: products.metaTitle },
  metaDescription: { label: 'Meta description', col: products.metaDescription },
  metaKeywords: { label: 'Meta keywords', col: products.metaKeywords },
  searchKeywords: { label: 'Search keywords', col: products.searchKeywords },
} as const;
export type BulkTextField = keyof typeof BULK_TEXT_FIELDS;

export type BulkOp =
  | { kind: 'replace'; find: string; replace: string; fields: BulkTextField[] }
  | { kind: 'image'; imageUrl: string; thumbUrl: string | null }
  | { kind: 'parent'; parentId: number | null }
  | { kind: 'active'; active: boolean };

export function parseIds(text: string): number[] {
  return [...new Set(text.split(/[^0-9]+/).map(Number).filter((n) => n > 0))].slice(0, 2000);
}

/** Builds the operation from form / query fields (shared by the preview page and the apply action). */
export function bulkOpFrom(f: { kind: string; find?: string | null; replace?: string | null; fields?: string[]; imageUrl?: string | null; thumbUrl?: string | null; parentId?: string | null; active?: string | null }): BulkOp {
  switch (f.kind) {
    case 'replace':
      return { kind: 'replace', find: f.find ?? '', replace: f.replace ?? '', fields: (f.fields ?? []).filter((x): x is BulkTextField => x in BULK_TEXT_FIELDS) };
    case 'image':
      if (!f.imageUrl?.trim()) throw new BulkError('Enter the image URL.');
      return { kind: 'image', imageUrl: f.imageUrl.trim(), thumbUrl: f.thumbUrl?.trim() || null };
    case 'parent':
      return { kind: 'parent', parentId: toInt(f.parentId) || null };
    case 'active':
      return { kind: 'active', active: toBool(f.active) };
    default:
      throw new BulkError('Choose an operation.');
  }
}

const chunk = <T>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** What the operation would touch: the products found (and, for find/replace, matches per field). */
export async function previewBulk(ids: number[], op: BulkOp) {
  const db = getDb();
  if (!ids.length) throw new BulkError('Enter at least one product id.');
  const found: { id: number; sku: string; name: string; active: boolean; parentProductId: number | null; imageUrl: string | null; matches: number }[] = [];
  for (const part of chunk(ids, 90)) {
    const rows = await db
      .select({
        id: products.id, sku: products.sku, name: products.name, active: products.active, parentProductId: products.parentProductId, imageUrl: products.imageUrl,
        matches: op.kind === 'replace' && op.fields.length && op.find ? sql<number>`${sql.join(op.fields.map((f) => sql`(instr(coalesce(${BULK_TEXT_FIELDS[f].col}, ''), ${op.find}) > 0)`), sql` + `)}` : sql<number>`0`,
      })
      .from(products)
      .where(inArray(products.id, part))
      .orderBy(asc(products.id));
    found.push(...rows);
  }
  const missing = ids.filter((id) => !found.some((f) => f.id === id));
  if (op.kind === 'parent' && op.parentId) {
    const parent = await db.query.products.findFirst({ columns: { id: true, sku: true, parentProductId: true }, where: eq(products.id, op.parentId) });
    if (!parent) throw new BulkError(`Parent product #${op.parentId} does not exist.`);
    if (parent.parentProductId) throw new BulkError(`#${op.parentId} (${parent.sku}) is itself a child SKU; children cannot be parents.`);
  }
  return { found, missing };
}

/** Applies the operation; returns the number of products updated. */
export async function applyBulk(ids: number[], op: BulkOp): Promise<number> {
  const db = getDb();
  const { found } = await previewBulk(ids, op);
  const targets = found.map((f) => f.id).filter((id) => op.kind !== 'parent' || id !== op.parentId);
  if (!targets.length) return 0;
  if (op.kind === 'replace') {
    if (!op.find) throw new BulkError('Enter the text to find.');
    if (!op.fields.length) throw new BulkError('Choose at least one field.');
    const set = Object.fromEntries(op.fields.map((f) => [f, sql`replace(coalesce(${BULK_TEXT_FIELDS[f].col}, ''), ${op.find}, ${op.replace})`]));
    for (const part of chunk(targets, 90)) await db.update(products).set(set).where(inArray(products.id, part));
    return targets.length;
  }
  const set = op.kind === 'image' ? { imageUrl: op.imageUrl, thumbUrl: op.thumbUrl ?? op.imageUrl } : op.kind === 'parent' ? { parentProductId: op.parentId } : { active: op.active };
  for (const part of chunk(targets, 90)) await db.update(products).set(set).where(inArray(products.id, part));
  return targets.length;
}

// ---------- export ----------

export const EXPORT_COLUMNS = [
  ['id', 'Id'], ['name', 'Title'], ['sku', 'SKU'], ['manufacturerSku', 'Manufacturer SKU'], ['brandName', 'Brand'], ['popRank', 'Pop rank'], ['price', 'Price'], ['listPrice', 'List price'], ['map', 'MAP'], ['cost', 'Cost'],
  ['stock', 'Stock'], ['actualInventory', 'Actual inventory'], ['ignoreStock', 'Ignore stock'], ['dropShip', 'Drop ship'], ['blockedReason', 'Blocked reason'], ['url', 'URL'], ['active', 'Active'], ['paired', 'Paired status'], ['upc', 'UPC'], ['weightOz', 'Weight (oz)'],
] as const;
export type ExportColumn = (typeof EXPORT_COLUMNS)[number][0];

export async function exportProducts(f: { q: string; searchDetails: boolean; includeInactive: boolean; limit?: number }) {
  const q = f.q.trim();
  const p = `%${q}%`;
  const base = siteUrl();
  const rows = await getDb()
    .select({
      id: products.id, name: products.name, sku: products.sku, manufacturerSku: products.manufacturerSku, brandName: products.brandName, popRank: products.popRank, priceCents: products.priceCents, listPriceCents: products.listPriceCents, mapCents: products.mapCents, costCents: products.costCents,
      stock: products.stock, actualInventory: products.actualInventory, ignoreStock: products.ignoreStock, dropShip: products.dropShip, blockedReason: products.blockedReason, slug: products.slug, active: products.active, parentProductId: products.parentProductId, upc: products.upc, weightOz: products.weightOz,
      childCount: sql<number>`(select count(*) from products c where c.parent_product_id = ${products.id})`,
    })
    .from(products)
    .where(and(q ? or(like(products.name, p), like(products.sku, p), like(products.shortDescription, p), like(products.manufacturerSku, p), f.searchDetails ? like(products.descriptionHtml, p) : undefined, /^\d+$/.test(q) ? eq(products.id, Number(q)) : undefined) : undefined, f.includeInactive ? undefined : eq(products.active, true)))
    .orderBy(asc(products.sku))
    .limit(f.limit ?? 5000);
  return rows.map((r) => ({ ...r, url: `${base}/p/${r.slug}`, paired: r.parentProductId ? 'Child' : r.childCount > 0 ? 'Parent' : 'Non-Paired' }));
}

export type ExportRow = Awaited<ReturnType<typeof exportProducts>>[number];

export function exportCell(r: ExportRow, c: ExportColumn): string | number {
  const d = (v: number | null) => (v === null ? '' : (v / 100).toFixed(2));
  switch (c) {
    case 'id': return r.id;
    case 'name': return r.name;
    case 'sku': return r.sku;
    case 'manufacturerSku': return r.manufacturerSku ?? '';
    case 'brandName': return r.brandName ?? '';
    case 'popRank': return r.popRank;
    case 'price': return d(r.priceCents);
    case 'listPrice': return d(r.listPriceCents);
    case 'map': return d(r.mapCents);
    case 'cost': return d(r.costCents);
    case 'stock': return r.stock;
    case 'actualInventory': return r.actualInventory ?? '';
    case 'ignoreStock': return r.ignoreStock ? 'Y' : 'N';
    case 'dropShip': return r.dropShip ? 'Y' : 'N';
    case 'blockedReason': return r.blockedReason ?? '';
    case 'url': return r.url;
    case 'active': return r.active ? 'Y' : 'N';
    case 'paired': return r.paired;
    case 'upc': return r.upc ?? '';
    case 'weightOz': return r.weightOz ?? '';
  }
}
