import { sql } from 'drizzle-orm';
import { getDb } from './db';
import { getProductsByIds } from './catalog';

/**
 * Products for a nominal air-filter size ("20x25x1").
 *
 * Stopgap until the legacy `search_products` / `actualSizes` tables are exported (roadmap P2 #8):
 * matches the size in product names and search keywords, and in option labels (Filtrete-style
 * size dropdowns). Once the real size table lands this becomes a straight lookup.
 */
export async function getProductsForSize(key: string, limit = 48) {
  const db = getDb();
  const compact = key.toLowerCase().replace(/\s+/g, '');
  const spaced = compact.replace(/x/g, ' x ');
  const rows = await db.all<{ id: number }>(sql`
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
  const items = await getProductsByIds(rows.map((r) => r.id));
  return items.sort((a, b) => a.popRank - b.popRank || b.stock - a.stock).slice(0, limit);
}

/** Sizes shown as quick links on the size page and in the header's Air Filters flyout. */
export const POPULAR_SIZES = ['16x20x1', '16x25x1', '20x20x1', '20x25x1', '20x30x1', '24x30x1', '16x25x4', '20x25x4', '20x25x5', '16x25x5'];
