import { eq } from 'drizzle-orm';
import { productCompareSpecs, products } from '@ff/db';
import { getDb } from './db';
import { getProductDetail, getProductOptions, productCard } from './catalog';
import { COMPARE_TYPES, compareFieldsFor } from './manager/products';

/**
 * Side-by-side product page (legacy SxS / prodViewHv2 compare layout): the product next to its
 * compare-to item, each with a full buy box, then a "Compare & Save" checklist. `compareSortOrder`
 * 2 puts the compared item first. When the compare-to item cannot be bought the legacy alternate
 * (`compareToAlt`) takes its place. Checklist rows come from `product_compare_specs` when both
 * share a compare type, otherwise from the classic name/value specs of either product.
 */

export interface CompareRow {
  label: string;
  values: [string, string];
  kind: 'bool' | 'text' | 'number';
}

const sideColumns = {
  ...productCard,
  manufacturerSku: products.manufacturerSku,
  parentProductId: products.parentProductId,
  compareDefaultOptionId: products.compareDefaultOptionId,
  shortDescription: products.shortDescription,
  descriptionHtml: products.descriptionHtml,
  packQty: products.packQty,
  active: products.active,
  hidden: products.hidden,
  blockedReason: products.blockedReason,
  recommendedFrequencyMonths: products.recommendedFrequencyMonths,
  madeInUsa: products.madeInUsa,
  returnPolicyCode: products.returnPolicyCode,
  autoshipEnabled: products.autoshipEnabled,
  isHomeAirFilter: products.isHomeAirFilter,
  isFfAirFilter: products.isFfAirFilter,
  prop65: products.prop65,
};

async function load(id: number) {
  const db = getDb();
  const [row] = await db.select(sideColumns).from(products).where(eq(products.id, id)).limit(1);
  if (!row) return null;
  const [detail, options, spec] = await Promise.all([getProductDetail(row.id, row.parentProductId), getProductOptions(row.id, row.parentProductId), db.query.productCompareSpecs.findFirst({ where: eq(productCompareSpecs.productId, row.id) })]);
  return { product: row, detail, options, spec: spec ?? null };
}

export type CompareSide = NonNullable<Awaited<ReturnType<typeof load>>>;
export type SideProduct = CompareSide['product'];

/** Can be shown and sold at all (not hidden, discontinued or blocked). */
export const listableSide = (p: SideProduct) => p.active && !p.hidden && p.stock !== -250 && !p.blockedReason;
/** Listable and purchasable right now. */
export const availableSide = (p: SideProduct) => listableSide(p) && (p.stock > 0 || p.ignoreStock);

/** Manager field names are sentence case ("Reduces lead"); the storefront checklist uses title case. */
const displayLabel = (label: string) => label.replace(/(^|\s|\/)([a-z])/g, (m, pre: string, c: string) => pre + c.toUpperCase());

function checklistRows(first: CompareSide, second: CompareSide, type: number): CompareRow[] {
  const rows: CompareRow[] = [];
  if (type > 0) {
    const a = JSON.parse(first.spec!.data) as Record<string, unknown>;
    const b = JSON.parse(second.spec!.data) as Record<string, unknown>;
    const months = (d: Record<string, unknown>) => {
      const from = d.filterLifeMonths;
      const to = d.filterLifeMonthsTo;
      if (from === undefined || from === null || from === '') return '—';
      return `${from}${to && to !== from ? `–${to}` : ''} Months`;
    };
    if (a.filterLifeMonths !== undefined || b.filterLifeMonths !== undefined) rows.push({ label: 'Filter Life', values: [months(a), months(b)], kind: 'text' });
    for (const f of compareFieldsFor(type)) {
      if (f.key === 'hideMerv' || f.key === 'filterLifeMonths' || f.key === 'filterLifeMonthsTo') continue;
      if ((f.key === 'merv' || f.key === 'flowRate') && (a.hideMerv || b.hideMerv)) continue;
      const va = a[f.key];
      const vb = b[f.key];
      const empty = (v: unknown) => v === undefined || v === null || v === '' || v === false;
      if (empty(va) && empty(vb)) continue;
      const fmt = (v: unknown) => (f.kind === 'bool' ? (v ? 'yes' : 'no') : empty(v) ? '—' : String(v));
      rows.push({ label: displayLabel(f.label), values: [fmt(va), fmt(vb)], kind: f.kind });
    }
  } else {
    const names = [...new Set([...first.detail.specs.map((s) => s.name), ...second.detail.specs.map((s) => s.name)])];
    for (const n of names) {
      const va = first.detail.specs.find((s) => s.name === n)?.value ?? '—';
      const vb = second.detail.specs.find((s) => s.name === n)?.value ?? '—';
      rows.push({ label: n, values: [va, vb], kind: 'text' });
    }
  }
  return rows;
}

/**
 * The side-by-side view for a product page, or null when the product has no usable comparison
 * (no compare-to, a sort order the legacy page ignored, or a compared item that cannot be shown).
 */
export async function getSideBySide(base: { id: number; compareToId: number | null; compareToAltId: number | null; compareSortOrder: number }) {
  if (!base.compareToId || (base.compareSortOrder !== 1 && base.compareSortOrder !== 2)) return null;
  const own = await load(base.id);
  if (!own) return null;
  let other = await load(base.compareToId);
  // Legacy: swap in compareToAlt when the compared item is out of stock or gone.
  if ((!other || !availableSide(other.product)) && base.compareToAltId && base.compareToAltId !== base.id) {
    const alt = await load(base.compareToAltId);
    if (alt && availableSide(alt.product)) other = alt;
  }
  if (!other || !listableSide(other.product)) return null;
  const [first, second] = base.compareSortOrder === 2 ? [other, own] : [own, other];
  const type = own.spec && other.spec && own.spec.compareType === other.spec.compareType ? own.spec.compareType : 0;
  return { first, second, rows: checklistRows(first, second, type), typeLabel: type > 0 ? COMPARE_TYPES[type]! : null, own, other };
}
