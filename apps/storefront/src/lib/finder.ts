import { and, asc, eq, sql } from 'drizzle-orm';
import { categories, refrigeratorFinder } from '@ff/db';
import { getDb } from './db';
import { getProductsByIds, type ProductCard } from './catalog';

/**
 * Refrigerator filter finder (legacy _INCappLanding_.asp refrigeratorLanding / refrigeratorFinderTool.asp):
 * brand → fridge style → filter location → removal method → product (with up to two alternates).
 * Rows come from the imported `refrigerator_finder` table; brand ids are the brand category ids.
 */

export interface FinderOption {
  id: number;
  name: string;
  count: number;
}

const active = eq(refrigeratorFinder.active, true);
/** Legacy stored a placeholder style 999 with an empty name for a few brands. */
const styleLabel = (id: number, name: string) => (name.trim() ? name.trim() : id === 999 ? 'Other / not sure' : `Style ${id}`);

export async function finderBrands(): Promise<{ id: number; name: string; slug: string | null; count: number }[]> {
  const rows = await getDb()
    .select({ id: refrigeratorFinder.brandCategoryId, name: categories.name, slug: categories.slug, count: sql<number>`count(*)` })
    .from(refrigeratorFinder)
    .leftJoin(categories, eq(categories.id, refrigeratorFinder.brandCategoryId))
    .where(active)
    .groupBy(refrigeratorFinder.brandCategoryId)
    .orderBy(asc(categories.name));
  return rows.map((r) => ({ id: r.id, name: (r.name ?? `Brand ${r.id}`).replace(/\s*(Replacement\s+)?Refrigerator Water Filters?$/i, '').trim(), slug: r.slug, count: r.count }));
}

export async function finderStyles(brandId: number): Promise<FinderOption[]> {
  const rows = await getDb()
    .select({ id: refrigeratorFinder.styleId, name: sql<string>`max(${refrigeratorFinder.styleName})`, count: sql<number>`count(*)` })
    .from(refrigeratorFinder)
    .where(and(active, eq(refrigeratorFinder.brandCategoryId, brandId)))
    .groupBy(refrigeratorFinder.styleId)
    .orderBy(asc(refrigeratorFinder.styleId));
  return rows.map((r) => ({ id: r.id, name: styleLabel(r.id, r.name), count: r.count }));
}

export async function finderLocations(brandId: number, styleId: number): Promise<FinderOption[]> {
  const rows = await getDb()
    .select({ id: refrigeratorFinder.locationId, name: sql<string>`max(${refrigeratorFinder.locationName})`, count: sql<number>`count(*)` })
    .from(refrigeratorFinder)
    .where(and(active, eq(refrigeratorFinder.brandCategoryId, brandId), eq(refrigeratorFinder.styleId, styleId)))
    .groupBy(refrigeratorFinder.locationId)
    .orderBy(asc(refrigeratorFinder.locationId));
  return rows.map((r) => ({ id: r.id, name: r.name || `Location ${r.id}`, count: r.count }));
}

export interface FinderRemoval extends FinderOption {
  imageUrl: string | null;
}

export async function finderRemovals(brandId: number, styleId: number, locationId: number): Promise<FinderRemoval[]> {
  const rows = await getDb()
    .select({ id: refrigeratorFinder.removalId, name: sql<string>`max(${refrigeratorFinder.removalName})`, imageUrl: sql<string | null>`max(${refrigeratorFinder.removalImageUrl})`, count: sql<number>`count(*)` })
    .from(refrigeratorFinder)
    .where(and(active, eq(refrigeratorFinder.brandCategoryId, brandId), eq(refrigeratorFinder.styleId, styleId), eq(refrigeratorFinder.locationId, locationId)))
    .groupBy(refrigeratorFinder.removalId)
    .orderBy(asc(refrigeratorFinder.removalId));
  return rows.map((r) => ({ id: r.id, name: r.name || `Method ${r.id}`, imageUrl: r.imageUrl, count: r.count }));
}

export interface FinderResult {
  products: ProductCard[];
  /** true when the legacy row lists alternates: "We found multiple filters for your refrigerator" */
  multiple: boolean;
}

export async function finderResult(brandId: number, styleId: number, locationId: number, removalId: number): Promise<FinderResult> {
  const rows = await getDb()
    .select({ productId: refrigeratorFinder.productId, alt1: refrigeratorFinder.altProductId1, alt2: refrigeratorFinder.altProductId2 })
    .from(refrigeratorFinder)
    .where(and(active, eq(refrigeratorFinder.brandCategoryId, brandId), eq(refrigeratorFinder.styleId, styleId), eq(refrigeratorFinder.locationId, locationId), eq(refrigeratorFinder.removalId, removalId)));
  const ids: number[] = [];
  for (const r of rows) for (const id of [r.productId, r.alt1, r.alt2]) if (id && id > 0 && !ids.includes(id)) ids.push(id);
  const found = await getProductsByIds(ids);
  const byId = new Map(found.map((p) => [p.id, p]));
  const products = ids.map((id) => byId.get(id)).filter((p): p is ProductCard => Boolean(p));
  return { products, multiple: products.length > 1 };
}
