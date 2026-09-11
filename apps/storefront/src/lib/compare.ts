import { eq } from 'drizzle-orm';
import { productCompareSpecs, products } from '@ff/db';
import { getDb } from './db';
import { getProductDetail, getProductOptions, productCard } from './catalog';
import { COMPARE_TYPES, compareFieldsFor } from './manager/products';

/**
 * Storefront side-by-side page (legacy SxS / prodCompare): an OEM product next to its
 * compare-to item. `compareSortOrder` 2 puts the compared item first. Rows come from
 * `product_compare_specs` when both share a compare type, otherwise from the classic
 * name/value specs of either product.
 */

export interface CompareRow {
  label: string;
  values: [string, string];
  kind: 'bool' | 'text' | 'number';
}

async function load(id: number) {
  const db = getDb();
  const p = await db.select({ ...productCard, parentProductId: products.parentProductId, compareDefaultOptionId: products.compareDefaultOptionId, shortDescription: products.shortDescription, packQty: products.packQty, active: products.active, hidden: products.hidden, blockedReason: products.blockedReason, recommendedFrequencyMonths: products.recommendedFrequencyMonths, madeInUsa: products.madeInUsa, returnPolicyCode: products.returnPolicyCode }).from(products).where(eq(products.id, id)).limit(1);
  const row = p[0];
  if (!row) return null;
  const [detail, options, spec] = await Promise.all([getProductDetail(row.id, row.parentProductId), getProductOptions(row.id, row.parentProductId), db.query.productCompareSpecs.findFirst({ where: eq(productCompareSpecs.productId, row.id) })]);
  return { product: row, detail, options, spec };
}

export type CompareSide = NonNullable<Awaited<ReturnType<typeof load>>>;

export async function getCompareView(slug: string) {
  const db = getDb();
  const base = await db.query.products.findFirst({ columns: { id: true, compareToId: true, compareSortOrder: true, active: true, hidden: true }, where: eq(products.slug, slug) });
  if (!base || !base.compareToId || base.hidden) return null;
  const [own, other] = await Promise.all([load(base.id), load(base.compareToId)]);
  if (!own || !other) return null;
  const [first, second] = base.compareSortOrder === 2 ? [other, own] : [own, other];
  const type = own.spec && other.spec && own.spec.compareType === other.spec.compareType ? own.spec.compareType : 0;
  const rows: CompareRow[] = [];
  if (type > 0) {
    const a = JSON.parse(own.spec!.data) as Record<string, unknown>;
    const b = JSON.parse(other.spec!.data) as Record<string, unknown>;
    const [fa, fb] = base.compareSortOrder === 2 ? [b, a] : [a, b];
    for (const f of compareFieldsFor(type)) {
      if (f.key === 'hideMerv') continue;
      const va = fa[f.key];
      const vb = fb[f.key];
      if ((va === undefined || va === '' || va === false) && (vb === undefined || vb === '' || vb === false)) continue;
      const fmt = (v: unknown) => (f.kind === 'bool' ? (v ? 'yes' : 'no') : v === undefined || v === null ? '—' : String(v));
      rows.push({ label: f.label, values: [fmt(va), fmt(vb)], kind: f.kind });
    }
  } else {
    const names = [...new Set([...first.detail.specs.map((s) => s.name), ...second.detail.specs.map((s) => s.name)])];
    for (const n of names) {
      const va = first.detail.specs.find((s) => s.name === n)?.value ?? '—';
      const vb = second.detail.specs.find((s) => s.name === n)?.value ?? '—';
      rows.push({ label: n, values: [va, vb], kind: 'text' });
    }
  }
  return { first, second, rows, typeLabel: type > 0 ? COMPARE_TYPES[type] : null, oem: own.product, compatible: other.product };
}
