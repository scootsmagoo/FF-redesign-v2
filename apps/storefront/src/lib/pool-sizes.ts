import { sql } from 'drizzle-orm';
import { getDb } from './db';
import { getProductsByIds } from './catalog';

/**
 * Pool & spa dimension finder (legacy getpoolsizes.asp), driven by the typed compare specs the
 * Manager stores for the Pool & Spa comparison type (15): length, diameter, top and bottom cap
 * styles and surface area. Options are the distinct values on file; a search matches every
 * dimension the shopper chose.
 */
export const POOL_DIMENSIONS = [
  ['length', 'pool_length', 'Length (inches)', 'Select Length'],
  ['diameter', 'pool_diameter', 'Diameter (inches)', 'Select Diameter'],
  ['top', 'pool_top_opening', 'Top Cap', 'Select Top Cap'],
  ['bottomDiameter', 'pool_bottom_opening', 'Bottom Cap', 'Select Bottom Cap'],
  ['surfaceArea', 'pool_surface_area', 'Square Footage', 'Select Square Footage'],
] as const;
export type PoolDimensionKey = (typeof POOL_DIMENSIONS)[number][0];
const POOL_TYPE = 15;

const numeric = (v: string) => Number.parseFloat(v.replace(/[^0-9.]/g, ''));
const byValue = (a: string, b: string) => {
  const [na, nb] = [numeric(a), numeric(b)];
  return Number.isFinite(na) && Number.isFinite(nb) && na !== nb ? na - nb : a.localeCompare(b, 'en', { numeric: true });
};

export async function getPoolDimensionOptions(): Promise<Record<PoolDimensionKey, string[]>> {
  const db = getDb();
  const out = {} as Record<PoolDimensionKey, string[]>;
  for (const [key] of POOL_DIMENSIONS) {
    const rows = await db.all<{ v: string | null }>(sql`
      select distinct trim(json_extract(s.data, ${'$.' + key})) as v
        from product_compare_specs s join products p on p.id = s.product_id
       where s.compare_type = ${POOL_TYPE} and p.active = 1 and p.hidden = 0 and p.stock <> -250
         and json_extract(s.data, ${'$.' + key}) is not null and trim(json_extract(s.data, ${'$.' + key})) <> ''`);
    out[key] = rows.map((r) => String(r.v)).filter(Boolean).sort(byValue);
  }
  return out;
}

export async function findPoolFilters(chosen: Partial<Record<PoolDimensionKey, string>>, limit = 48) {
  const db = getDb();
  const conds = POOL_DIMENSIONS.filter(([key]) => chosen[key]).map(([key]) => sql`lower(trim(json_extract(s.data, ${'$.' + key}))) = ${chosen[key]!.trim().toLowerCase()}`);
  if (!conds.length) return [];
  const rows = await db.all<{ id: number }>(sql`
    select p.id from product_compare_specs s join products p on p.id = s.product_id
     where s.compare_type = ${POOL_TYPE} and p.active = 1 and p.hidden = 0 and p.stock <> -250 and ${sql.join(conds, sql` and `)}
     order by p.pop_rank, p.stock desc limit ${limit}`);
  return rows.length ? getProductsByIds(rows.map((r) => r.id)) : [];
}
