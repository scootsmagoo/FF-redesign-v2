import { and, eq, inArray, sql } from 'drizzle-orm';
import { categories, categoryProducts, promoCodes, promotions } from '@ff/db';
import { normalizeCode, type PromotionRule } from '@ff/domain/promotions';
import { getDb } from './db';

export const MAX_CODES = 3;

type PromotionRow = typeof promotions.$inferSelect;

/** Legacy stored most percentages as fractions (0.1) and a few as whole numbers (10). */
function normalizePercent(v: number | null): number | null {
  if (v === null || v === undefined) return null;
  return v > 0 && v <= 1 ? Math.round(v * 10000) / 100 : v;
}

function toRule(row: PromotionRow): PromotionRule {
  let legacy: Record<string, unknown> | undefined;
  try {
    legacy = JSON.parse(row.legacyJson) as Record<string, unknown>;
  } catch {
    legacy = undefined;
  }
  return {
    id: row.id,
    code: row.code,
    tag: row.tag,
    title: row.title,
    status: row.status,
    percentOff: normalizePercent(row.percentOff),
    amountOffCents: row.amountOffCents,
    minSubtotalCents: row.minSubtotalCents,
    maxSubtotalCents: row.maxSubtotalCents,
    validFrom: row.validFrom,
    validTo: row.validTo,
    onceOnly: row.onceOnly,
    freeShipping: row.freeShipping,
    exclusive: row.exclusive,
    compoundable: row.compoundable,
    scopeKind: row.scopeKind,
    scopeRef: row.scopeRef,
    matchValue: row.matchValue,
    giftWithPurchase: row.giftWithPurchase,
    bogo: row.bogo,
    tiered: row.tiered,
    legacy,
  };
}

export interface ResolvedCode {
  code: string;
  rule: PromotionRule | null;
  /** set when the code came from the single-use table */
  singleUse: boolean;
}

/**
 * Finds the promotion behind a code: a public code on `promotions`, or a single-use code in
 * `promo_codes` that points at a promotion tag. Returns rule=null when nothing matches.
 */
export async function resolveCode(input: string): Promise<ResolvedCode> {
  const code = normalizeCode(input);
  const db = getDb();
  if (!code) return { code, rule: null, singleUse: false };

  const direct = await db
    .select()
    .from(promotions)
    .where(eq(sql`upper(replace(${promotions.code}, ' ', ''))`, code))
    .orderBy(sql`case when ${promotions.status} = 'active' then 0 else 1 end`)
    .limit(1);
  if (direct[0]) return { code, rule: toRule(direct[0]), singleUse: false };

  const single = await db.select({ tag: promoCodes.tag, status: promoCodes.status }).from(promoCodes).where(eq(promoCodes.code, code)).limit(1);
  if (single[0]) {
    if (single[0].status !== 'active') return { code, rule: { ...(await ruleByTag(single[0].tag)), status: 'inactive' } as PromotionRule, singleUse: true };
    const rule = await ruleByTag(single[0].tag);
    return { code, rule, singleUse: true };
  }
  return { code, rule: null, singleUse: false };
}

async function ruleByTag(tag: string): Promise<PromotionRule | null> {
  const row = await getDb()
    .select()
    .from(promotions)
    .where(eq(promotions.tag, tag))
    .orderBy(sql`case when ${promotions.status} = 'active' then 0 else 1 end`)
    .limit(1);
  return row[0] ? toRule(row[0]) : null;
}

export async function resolveCodes(codes: string[]): Promise<ResolvedCode[]> {
  return Promise.all(codes.map(resolveCode));
}

/** productId → category ids including each category's parent chain (for category-scoped promos). */
export async function categoryIdsForProducts(productIds: number[]): Promise<Map<number, number[]>> {
  const out = new Map<number, number[]>();
  if (!productIds.length) return out;
  const db = getDb();
  const rows = await db
    .select({ productId: categoryProducts.productId, categoryId: categoryProducts.categoryId, parentId: categories.parentId })
    .from(categoryProducts)
    .innerJoin(categories, eq(categories.id, categoryProducts.categoryId))
    .where(inArray(categoryProducts.productId, productIds));
  const parentIds = [...new Set(rows.map((r) => r.parentId).filter((p): p is number => typeof p === 'number' && p > 1))];
  const grand = parentIds.length ? await db.select({ id: categories.id, parentId: categories.parentId }).from(categories).where(inArray(categories.id, parentIds)) : [];
  const grandOf = new Map(grand.map((g) => [g.id, g.parentId]));
  for (const r of rows) {
    const list = out.get(r.productId) ?? [];
    list.push(r.categoryId);
    if (r.parentId) list.push(r.parentId);
    const gp = r.parentId ? grandOf.get(r.parentId) : null;
    if (gp) list.push(gp);
    out.set(r.productId, [...new Set(list)]);
  }
  return out;
}

/** Marks single-use codes as consumed by an order. */
export async function consumeSingleUseCodes(codes: string[], orderId: number): Promise<void> {
  if (!codes.length) return;
  await getDb()
    .update(promoCodes)
    .set({ status: 'used', usedOrderId: orderId, usedAt: sql`(current_timestamp)` })
    .where(and(inArray(promoCodes.code, codes.map(normalizeCode)), eq(promoCodes.status, 'active')));
}
