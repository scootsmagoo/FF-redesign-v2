import { sql } from 'drizzle-orm';
import { getDb } from './db';
import { getProductsByIds } from './catalog';

/**
 * Pool & spa dimension finder (legacy getpoolsizes.asp). Options are the distinct values on file
 * for products in the Pool & Spa category tree, read from the classic name/value specs (Length,
 * Diameter, Top, Bottom, Surface Area) and from the typed Pool & Spa compare specs (type 15).
 * A search matches every dimension the shopper chose.
 */
export const POOL_DIMENSIONS = [
  ['length', 'pool_length', 'Length (inches)', 'Select Length', ['Length']],
  ['diameter', 'pool_diameter', 'Diameter (inches)', 'Select Diameter', ['Diameter']],
  ['top', 'pool_top_opening', 'Top Cap', 'Select Top Cap', ['Top', 'Top Cap']],
  ['bottomDiameter', 'pool_bottom_opening', 'Bottom Cap', 'Select Bottom Cap', ['Bottom', 'Bottom Cap']],
  ['surfaceArea', 'pool_surface_area', 'Square Footage', 'Select Square Footage', ['Surface Area', 'Square Footage']],
] as const;
export type PoolDimensionKey = (typeof POOL_DIMENSIONS)[number][0];
const POOL_TYPE = 15;
const POOL_ROOT_SLUG = 'pool-spa-filters';

/** `31-1/8"` → `31-1/8`; collapses spacing and quote marks so the same size spelled two ways is one option. */
export const normalizeDimension = (v: string) => v.replace(/["”]/g, '').replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim();
const asNumber = (v: string) => {
  const m = /^(\d+(?:\.\d+)?)(?:[\s-]+(\d+)\/(\d+))?/.exec(v);
  return m ? Number(m[1]) + (m[2] ? Number(m[2]) / Number(m[3]) : 0) : Number.NaN;
};
const byValue = (a: string, b: string) => {
  const [na, nb] = [asNumber(a), asNumber(b)];
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  if (Number.isFinite(na) !== Number.isFinite(nb)) return Number.isFinite(na) ? -1 : 1;
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
};

/** Every (product, key, value) on file for pool products, both spec sources. */
async function poolValues(): Promise<{ productId: number; key: PoolDimensionKey; value: string }[]> {
  const db = getDb();
  const root = await db.all<{ id: number }>(sql`select id from categories where slug = ${POOL_ROOT_SLUG} limit 1`);
  if (!root[0]) return [];
  const tree = await db.all<{ id: number; parent_id: number | null }>(sql`select id, parent_id from categories where active = 1`);
  const byParent = new Map<number | null, number[]>();
  for (const c of tree) (byParent.get(c.parent_id) ?? byParent.set(c.parent_id, []).get(c.parent_id)!).push(c.id);
  const ids = new Set<number>();
  const stack = [root[0].id];
  while (stack.length) {
    const id = stack.pop()!;
    if (ids.has(id)) continue;
    ids.add(id);
    stack.push(...(byParent.get(id) ?? []));
  }
  const inTree = sql.raw([...ids].map((n) => String(Math.trunc(n))).join(', '));
  const listable = sql`p.active = 1 and p.hidden = 0 and p.stock <> -250 and coalesce(p.blocked_reason, '') = ''`;
  const specNames = POOL_DIMENSIONS.flatMap(([, , , , names]) => names.map((n) => n.toLowerCase()));
  const classic = await db.all<{ product_id: number; name: string; value: string }>(sql`
    select s.product_id, lower(s.name) as name, s.value from product_specs s join products p on p.id = s.product_id
     where ${listable} and lower(s.name) in (${sql.join(specNames.map((n) => sql`${n}`), sql`, `)})
       and s.product_id in (select product_id from category_products where category_id in (${inTree}))`);
  const typed = await db.all<{ product_id: number; data: string }>(sql`
    select s.product_id, s.data from product_compare_specs s join products p on p.id = s.product_id where s.compare_type = ${POOL_TYPE} and ${listable}`);
  const out: { productId: number; key: PoolDimensionKey; value: string }[] = [];
  for (const r of classic) {
    const dim = POOL_DIMENSIONS.find(([, , , , names]) => names.some((n) => n.toLowerCase() === r.name));
    const v = normalizeDimension(r.value ?? '');
    if (dim && v) out.push({ productId: r.product_id, key: dim[0], value: v });
  }
  for (const r of typed) {
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(r.data); } catch { /* ignore malformed */ }
    for (const [key] of POOL_DIMENSIONS) {
      const v = data[key];
      if (v !== undefined && v !== null && String(v).trim() !== '') out.push({ productId: r.product_id, key, value: normalizeDimension(String(v)) });
    }
  }
  return out;
}

export async function getPoolDimensionOptions(): Promise<Record<PoolDimensionKey, string[]>> {
  const values = await poolValues();
  const out = {} as Record<PoolDimensionKey, string[]>;
  for (const [key] of POOL_DIMENSIONS) {
    const seen = new Map<string, string>();
    for (const v of values) if (v.key === key && !seen.has(v.value.toLowerCase())) seen.set(v.value.toLowerCase(), v.value);
    out[key] = [...seen.values()].sort(byValue);
  }
  return out;
}

export async function findPoolFilters(chosen: Partial<Record<PoolDimensionKey, string>>, limit = 48) {
  const wanted = POOL_DIMENSIONS.filter(([key]) => chosen[key]).map(([key]) => [key, normalizeDimension(chosen[key]!).toLowerCase()] as const);
  if (!wanted.length) return [];
  const values = await poolValues();
  const matches = new Map<number, Set<PoolDimensionKey>>();
  for (const v of values) {
    if (wanted.some(([key, val]) => key === v.key && v.value.toLowerCase() === val)) (matches.get(v.productId) ?? matches.set(v.productId, new Set()).get(v.productId)!).add(v.key);
  }
  const ids = [...matches].filter(([, keys]) => wanted.every(([key]) => keys.has(key))).map(([id]) => id).slice(0, limit);
  return ids.length ? getProductsByIds(ids) : [];
}
