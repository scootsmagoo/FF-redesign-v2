import { and, asc, eq, sql } from 'drizzle-orm';
import { airFilterSizeProducts, airFilterSizes } from '@ff/db';
import { getDb } from './db';
import { getProductsByIds, type ProductCard } from './catalog';

/**
 * Products for a nominal air-filter size ("20x25x1").
 *
 * Primary source is the imported legacy `search_products` matrix (`air_filter_size_products`):
 * one row per size × product/option with the MERV grade and brand, in the grid order the legacy
 * listbysize2.asp used. Sizes without a matrix entry fall back to a text match on names,
 * keywords and option labels so a valid size never dead-ends.
 */
export interface SizeProduct extends ProductCard {
  merv: string | null;
  optionId: number | null;
}

export async function getProductsForSize(key: string, limit = 48): Promise<{ items: SizeProduct[]; source: 'matrix' | 'search' }> {
  const db = getDb();
  const rows = await db
    .select({ productId: airFilterSizeProducts.productId, optionId: airFilterSizeProducts.optionId, merv: airFilterSizeProducts.merv, row: airFilterSizeProducts.row, col: airFilterSizeProducts.col })
    .from(airFilterSizeProducts)
    .where(and(eq(airFilterSizeProducts.sizeKey, key), eq(airFilterSizeProducts.active, true)))
    .orderBy(asc(airFilterSizeProducts.row), asc(airFilterSizeProducts.col));
  if (rows.length) {
    const cards = new Map((await getProductsByIds([...new Set(rows.map((r) => r.productId))])).map((c) => [c.id, c]));
    const seen = new Set<number>();
    const items: SizeProduct[] = [];
    for (const r of rows) {
      const c = cards.get(r.productId);
      if (!c || seen.has(r.productId)) continue;
      seen.add(r.productId);
      items.push({ ...c, merv: r.merv, optionId: r.optionId });
    }
    if (items.length) return { items: items.slice(0, limit), source: 'matrix' };
  }

  const compact = key.toLowerCase().replace(/\s+/g, '');
  const spaced = compact.replace(/x/g, ' x ');
  const found = await db.all<{ id: number }>(sql`
    select distinct id from (
      select p.id from products p
       where (lower(p.name) like ${'%' + compact + '%'} or lower(p.name) like ${'%' + spaced + '%'}
           or lower(coalesce(p.search_keywords, '')) like ${'%' + compact + '%'})
      union
      select pog.product_id as id from options o
        join product_option_groups pog on pog.group_id = o.group_id
       where replace(replace(lower(o.label), ' ', ''), '"', '') like ${compact + '%'}
    )
    limit ${limit * 3}
  `);
  const items = (await getProductsByIds(found.map((r) => r.id))).sort((a, b) => a.popRank - b.popRank || b.stock - a.stock).slice(0, limit);
  return { items: items.map((c) => ({ ...c, merv: null, optionId: null })), source: 'search' };
}

/** Sizes that have at least one active matrix entry, for the size index and "popular sizes" strip. */
export async function listSizes(): Promise<string[]> {
  const rows = await getDb().select({ key: airFilterSizes.key, h: airFilterSizes.height, w: airFilterSizes.width, d: airFilterSizes.depth }).from(airFilterSizes).where(eq(airFilterSizes.active, true));
  return rows.sort((a, b) => a.d - b.d || a.h - b.h || a.w - b.w).map((r) => r.key);
}

/** Curated quick links shown on every size page and in the header's Air Filters flyout. */
export const POPULAR_SIZES = ['16x20x1', '16x25x1', '20x20x1', '20x25x1', '20x30x1', '24x30x1', '16x25x4', '20x25x4', '20x25x5', '16x25x5'];
