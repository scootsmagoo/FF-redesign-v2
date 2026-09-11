import { and, asc, desc, eq, gte, inArray, like, lte, or, sql } from 'drizzle-orm';
import { affiliateItems, affiliates, categories, customers, newsletters, orders, products, promoCodes, promotions } from '@ff/db';
import { slugify } from '@ff/domain/urls';
import { getDb } from '../db';
import { sendRendered } from '../emails';
import { offsetFor, PAGE_SIZE } from './util';

/**
 * Marketing side of the manager: promotions (legacy SA_prod_discounts / SA_disc), promo stats
 * (sa_discount_stat), newsletters (SA_news*), affiliates (sa_affiliates / SA_aff).
 */

export class MarketingError extends Error {}

// ---------- promotions ----------

export const PROMO_VIEWS = ['active', 'dotd', 'inactive', 'locked', 'upcoming', 'expired'] as const;
export const DOTD_CODE = 'daily-deal';

/** Legacy scope sentinels (promoItemDisc). */
export const SCOPE_CLASSES: Record<number, string> = { [-6]: 'Refrigerator filters', [-7]: 'Filters Fast water filters', [-8]: 'Home air filters', [-9]: 'Humidifier filters', [-5]: 'Brand (match value)', [-4]: 'Product id list (match value)' };

export function promoState(p: { status: string; validFrom: string | null; validTo: string | null }, today = new Date().toISOString().slice(0, 10)): 'inactive' | 'upcoming' | 'expired' | 'active' {
  if (p.status !== 'active') return 'inactive';
  if (p.validFrom && p.validFrom > today) return 'upcoming';
  if (p.validTo && p.validTo < today) return 'expired';
  return 'active';
}

export function describeScope(p: { scopeKind: number; scopeRef: number | null; matchValue: string | null }, names: { product?: string; category?: string } = {}): string {
  if (p.scopeKind === 1 && p.scopeRef && p.scopeRef > 0) return `Product: ${names.product ?? `#${p.scopeRef}`}`;
  if (p.scopeKind === 2 && p.scopeRef && p.scopeRef > 0) return `Category: ${names.category ?? `#${p.scopeRef}`}`;
  if (p.scopeRef && p.scopeRef < 0) return `${SCOPE_CLASSES[p.scopeRef] ?? `Class ${p.scopeRef}`}${p.matchValue ? ` (${p.matchValue})` : ''}`;
  return 'Whole order';
}

export function describeDiscount(p: { percentOff: number | null; amountOffCents: number | null; freeShipping: boolean; bogo: boolean; tiered: boolean; giftWithPurchase: boolean; multiplyByQty: boolean }): string {
  const parts: string[] = [];
  if (p.bogo) parts.push('BOGO');
  if (p.tiered) parts.push('Tiered sale');
  else if (p.percentOff) parts.push(`${p.percentOff > 0 && p.percentOff <= 1 ? Math.round(p.percentOff * 10000) / 100 : p.percentOff}% off${p.multiplyByQty ? ' each' : ''}`);
  else if (p.amountOffCents) parts.push(`$${(p.amountOffCents / 100).toFixed(2)} off${p.multiplyByQty ? ' each' : ''}`);
  if (p.freeShipping) parts.push('free shipping');
  if (p.giftWithPurchase) parts.push('gift with purchase');
  return parts.join(' + ') || '—';
}

export async function listPromotions(view: (typeof PROMO_VIEWS)[number], q = '') {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const conds = [];
  if (q.trim()) conds.push(or(like(promotions.code, `%${q.trim()}%`), like(promotions.title, `%${q.trim()}%`), like(promotions.tag, `%${q.trim()}%`)));
  if (view === 'dotd') conds.push(eq(promotions.code, DOTD_CODE));
  else conds.push(or(sql`${promotions.code} is null`, sql`${promotions.code} <> ${DOTD_CODE}`));
  if (view === 'locked') conds.push(eq(promotions.locked, true));
  else if (view !== 'dotd') conds.push(eq(promotions.locked, false));
  if (view === 'active' || view === 'dotd' || view === 'locked') conds.push(eq(promotions.status, 'active'));
  if (view === 'inactive') conds.push(sql`${promotions.status} <> 'active'`);
  if (view === 'upcoming') conds.push(and(eq(promotions.status, 'active'), sql`${promotions.validFrom} > ${today}`));
  if (view === 'expired') conds.push(and(eq(promotions.status, 'active'), sql`${promotions.validTo} < ${today}`));
  const rows = await db
    .select()
    .from(promotions)
    .where(and(...conds))
    .orderBy(desc(promotions.validTo), desc(promotions.id))
    .limit(500);
  const pids = rows.filter((r) => r.scopeKind === 1 && r.scopeRef && r.scopeRef > 0).map((r) => r.scopeRef!);
  const cids = rows.filter((r) => r.scopeKind === 2 && r.scopeRef && r.scopeRef > 0).map((r) => r.scopeRef!);
  const [pn, cn] = await Promise.all([
    pids.length ? db.select({ id: products.id, sku: products.sku }).from(products).where(inArray(products.id, pids.slice(0, 90))) : [],
    cids.length ? db.select({ id: categories.id, name: categories.name }).from(categories).where(inArray(categories.id, cids.slice(0, 90))) : [],
  ]);
  const pm = new Map(pn.map((p) => [p.id, p.sku]));
  const cm = new Map(cn.map((c) => [c.id, c.name]));
  return rows.map((r) => ({ ...r, state: promoState(r, today), scopeLabel: describeScope(r, { product: r.scopeRef ? pm.get(r.scopeRef) : undefined, category: r.scopeRef ? cm.get(r.scopeRef) : undefined }), discountLabel: describeDiscount(r) }));
}

export async function getPromotion(id: number) {
  const db = getDb();
  const p = await db.query.promotions.findFirst({ where: eq(promotions.id, id) });
  if (!p) return null;
  let legacy: Record<string, unknown> = {};
  try {
    legacy = JSON.parse(p.legacyJson) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  const [codes] = await db.select({ n: sql<number>`count(*)`, used: sql<number>`sum(case when ${promoCodes.status} = 'used' then 1 else 0 end)` }).from(promoCodes).where(eq(promoCodes.tag, p.tag ?? ''));
  return { promotion: p, legacy, singleUseCodes: codes?.n ?? 0, singleUseUsed: codes?.used ?? 0 };
}

export interface PromotionInput {
  code: string | null;
  title: string | null;
  status: 'active' | 'inactive';
  discountType: 'percent' | 'amount' | 'none';
  percentOff: number | null;
  amountOffCents: number | null;
  minSubtotalCents: number | null;
  maxSubtotalCents: number | null;
  validFrom: string | null;
  validTo: string | null;
  onceOnly: boolean;
  singleUse: boolean;
  usableEveryDays: number | null;
  freeShipping: boolean;
  exclusive: boolean;
  compoundable: boolean;
  allowOnForms: boolean;
  multiplyByQty: boolean;
  scopeKind: number;
  scopeRef: number | null;
  matchValue: string | null;
  giftWithPurchase: boolean;
  bogo: boolean;
  tiered: boolean;
  tiers: { thresholdCents: number; amountCents: number }[];
  landingKind: number;
  contentHtml: string | null;
  imageUrl: string | null;
  productText: string | null;
  notes: string | null;
  locked: boolean;
  /** extra legacy fields kept verbatim */
  legacyExtra?: Record<string, unknown>;
}

function randomTag(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}

export async function savePromotion(id: number | null, input: PromotionInput, adminEmail: string, isSiteAdmin: boolean): Promise<number> {
  const db = getDb();
  const code = input.code?.trim().toUpperCase() || null;
  if (!code && input.landingKind !== 1) throw new MarketingError('A promo code is required (blank codes are only for landing-page campaigns).');
  if (code && /[\s'"]/.test(code)) throw new MarketingError('Codes cannot contain spaces or quotes.');
  if (code && code.length > 20) throw new MarketingError('Codes are at most 20 characters.');
  if (input.discountType === 'percent' && !(input.percentOff && input.percentOff > 0 && input.percentOff <= 100)) throw new MarketingError('Percent off must be between 0 and 100.');
  if (input.discountType === 'amount' && !(input.amountOffCents && input.amountOffCents > 0)) throw new MarketingError('Amount off must be positive.');
  if (input.discountType === 'none' && !input.freeShipping && !input.bogo && !input.tiered && !input.giftWithPurchase) throw new MarketingError('Choose a discount, free shipping, BOGO, tiers or a gift.');
  if (input.validFrom && input.validTo && input.validTo < input.validFrom) throw new MarketingError('"Valid to" must not be before "valid from".');
  if (input.minSubtotalCents !== null && input.maxSubtotalCents !== null && input.maxSubtotalCents < input.minSubtotalCents) throw new MarketingError('Maximum cart total must be at least the minimum.');
  if ((input.scopeKind === 1 || input.scopeKind === 2) && !(input.scopeRef && input.scopeRef > 0)) throw new MarketingError('Enter the product or category id for the scope.');
  if (input.scopeKind === 1 && input.scopeRef) {
    const p = await db.query.products.findFirst({ columns: { id: true }, where: eq(products.id, input.scopeRef) });
    if (!p) throw new MarketingError(`Product #${input.scopeRef} does not exist.`);
  }
  if (input.scopeKind === 2 && input.scopeRef) {
    const c = await db.query.categories.findFirst({ columns: { id: true }, where: eq(categories.id, input.scopeRef) });
    if (!c) throw new MarketingError(`Category #${input.scopeRef} does not exist.`);
  }
  if (code) {
    const dup = await db.select({ id: promotions.id }).from(promotions).where(and(sql`upper(${promotions.code}) = ${code}`, code === DOTD_CODE.toUpperCase() ? sql`1 = 0` : sql`1 = 1`)).limit(1);
    if (dup[0] && dup[0].id !== id) throw new MarketingError(`Code ${code} is already used by promotion #${dup[0].id}.`);
  }
  const existing = id ? await db.query.promotions.findFirst({ where: eq(promotions.id, id) }) : null;
  if (existing?.locked && !isSiteAdmin) throw new MarketingError('This promotion is locked; only a Site Administrator can change it.');
  if (input.locked && !isSiteAdmin) throw new MarketingError('Only a Site Administrator can lock a promotion.');

  // amount discount below the minimum cart makes no sense: raise the minimum, as the legacy did
  let minSubtotalCents = input.minSubtotalCents;
  if (input.discountType === 'amount' && input.amountOffCents && (minSubtotalCents ?? 0) < input.amountOffCents) minSubtotalCents = input.amountOffCents;

  let legacy: Record<string, unknown> = {};
  try {
    legacy = existing ? (JSON.parse(existing.legacyJson) as Record<string, unknown>) : {};
  } catch {
    legacy = {};
  }
  Object.assign(legacy, input.legacyExtra ?? {}, {
    tieredSaleFlag: input.tiered ? 1 : 0,
    tieredThresh1: input.tiers[0]?.thresholdCents ? input.tiers[0].thresholdCents / 100 : 0,
    tieredDiscAmt1: input.tiers[0]?.amountCents ? input.tiers[0].amountCents / 100 : 0,
    tieredThresh2: input.tiers[1]?.thresholdCents ? input.tiers[1].thresholdCents / 100 : 0,
    tieredDiscAmt2: input.tiers[1]?.amountCents ? input.tiers[1].amountCents / 100 : 0,
    tieredThresh3: input.tiers[2]?.thresholdCents ? input.tiers[2].thresholdCents / 100 : 0,
    tieredDiscAmt3: input.tiers[2]?.amountCents ? input.tiers[2].amountCents / 100 : 0,
    tieredThresh4: input.tiers[3]?.thresholdCents ? input.tiers[3].thresholdCents / 100 : 0,
    tieredDiscAmt4: input.tiers[3]?.amountCents ? input.tiers[3].amountCents / 100 : 0,
  });

  const row = {
    code,
    title: input.title?.trim() || null,
    status: input.status,
    percentOff: input.discountType === 'percent' ? input.percentOff : null,
    amountOffCents: input.discountType === 'amount' ? input.amountOffCents : null,
    minSubtotalCents,
    maxSubtotalCents: input.maxSubtotalCents,
    validFrom: input.validFrom || null,
    validTo: input.validTo || null,
    onceOnly: input.onceOnly,
    freeShipping: input.freeShipping,
    exclusive: input.exclusive,
    compoundable: input.compoundable,
    allowOnForms: input.allowOnForms,
    scopeKind: input.scopeKind,
    scopeRef: input.scopeRef,
    matchValue: input.matchValue?.trim() || null,
    giftWithPurchase: input.giftWithPurchase,
    bogo: input.bogo,
    tiered: input.tiered,
    singleUse: input.singleUse,
    multiplyByQty: input.multiplyByQty,
    usableEveryDays: input.usableEveryDays,
    landingKind: input.landingKind,
    contentHtml: input.contentHtml || null,
    imageUrl: input.imageUrl?.trim() || null,
    productText: input.productText?.trim() || null,
    notes: input.notes?.trim() || null,
    locked: input.locked,
    legacyJson: JSON.stringify(legacy),
    updatedAt: new Date().toISOString(),
  };
  if (id && existing) {
    // Unlike the legacy editor, the campaign tag is kept on edit so shared ?contextTag= links keep working.
    await db.update(promotions).set(row).where(eq(promotions.id, id));
    return id;
  }
  let tag = randomTag();
  for (let i = 0; i < 10; i++) {
    const t = await db.select({ id: promotions.id }).from(promotions).where(eq(promotions.tag, tag)).limit(1);
    if (!t[0]) break;
    tag = randomTag();
  }
  const [max] = await db.select({ m: sql<number>`coalesce(max(id), 0)` }).from(promotions);
  const newId = (max?.m ?? 0) + 1;
  await db.insert(promotions).values({ ...row, id: newId, tag, createdBy: adminEmail });
  return newId;
}

export async function setPromotionStatus(id: number, status: 'active' | 'inactive', isSiteAdmin: boolean): Promise<void> {
  const db = getDb();
  const p = await db.query.promotions.findFirst({ columns: { locked: true }, where: eq(promotions.id, id) });
  if (!p) throw new MarketingError('Promotion not found.');
  if (p.locked && !isSiteAdmin) throw new MarketingError('This promotion is locked.');
  await db.update(promotions).set({ status, updatedAt: new Date().toISOString() }).where(eq(promotions.id, id));
}

export async function duplicatePromotion(id: number, adminEmail: string): Promise<number> {
  const db = getDb();
  const p = await db.query.promotions.findFirst({ where: eq(promotions.id, id) });
  if (!p) throw new MarketingError('Promotion not found.');
  const { id: _id, tag: _t, createdAt: _c, createdBy: _b, updatedAt: _u, ...rest } = p;
  let code = p.code;
  let validFrom = p.validFrom;
  let validTo = p.validTo;
  if (p.code === DOTD_CODE) {
    // the daily deal copies to the next day, as on the legacy site
    const next = (d: string | null) => (d ? new Date(new Date(d).getTime() + 86_400_000).toISOString().slice(0, 10) : d);
    validFrom = next(validFrom);
    validTo = next(validTo);
  } else if (code) {
    code = `${code}-COPY`.slice(0, 20);
  }
  let tag = randomTag();
  for (let i = 0; i < 10; i++) {
    const t = await db.select({ id: promotions.id }).from(promotions).where(eq(promotions.tag, tag)).limit(1);
    if (!t[0]) break;
    tag = randomTag();
  }
  const [max] = await db.select({ m: sql<number>`coalesce(max(id), 0)` }).from(promotions);
  const newId = (max?.m ?? 0) + 1;
  await db.insert(promotions).values({ ...rest, id: newId, code, validFrom, validTo, status: p.code === DOTD_CODE ? p.status : 'inactive', locked: false, tag, createdBy: adminEmail, updatedAt: new Date().toISOString() });
  return newId;
}

export async function deletePromotion(id: number, isSiteAdmin: boolean): Promise<void> {
  const db = getDb();
  const p = await db.query.promotions.findFirst({ columns: { locked: true, tag: true }, where: eq(promotions.id, id) });
  if (!p) return;
  if (p.locked && !isSiteAdmin) throw new MarketingError('This promotion is locked.');
  await db.delete(promotions).where(eq(promotions.id, id));
}

/** Usage per code over a period, from orders' promo_codes JSON (legacy sa_discount_stat). */
export async function promoStats(fromIso: string, toIso: string) {
  const db = getDb();
  const rows = await db
    .select({ promoCodes: orders.promoCodes, discountCents: orders.discountCents, subtotalCents: orders.subtotalCents, totalCents: orders.totalCents, placedAt: orders.placedAt, number: orders.number, id: orders.id, customerId: orders.customerId })
    .from(orders)
    .where(and(gte(orders.placedAt, fromIso), lte(orders.placedAt, `${toIso}T23:59:59`), inArray(orders.status, ['paid', 'processing', 'shipped', 'complete']), sql`${orders.promoCodes} is not null and ${orders.promoCodes} <> '[]'`))
    .orderBy(desc(orders.placedAt))
    .limit(5000);
  const byCode = new Map<string, { orders: number; discountCents: number; subtotalCents: number }>();
  const detail: { code: string; number: string; id: number; customerId: number | null; placedAt: string; subtotalCents: number; discountCents: number; totalCents: number }[] = [];
  for (const r of rows) {
    let codes: string[] = [];
    try {
      codes = (JSON.parse(r.promoCodes ?? '[]') as string[]).filter(Boolean);
    } catch {
      continue;
    }
    for (const c of codes) {
      const k = c.toUpperCase();
      const cur = byCode.get(k) ?? { orders: 0, discountCents: 0, subtotalCents: 0 };
      cur.orders++;
      cur.discountCents += Math.round(r.discountCents / codes.length);
      cur.subtotalCents += r.subtotalCents;
      byCode.set(k, cur);
      detail.push({ code: k, number: r.number, id: r.id, customerId: r.customerId, placedAt: r.placedAt, subtotalCents: r.subtotalCents, discountCents: r.discountCents, totalCents: r.totalCents });
    }
  }
  return { summary: [...byCode.entries()].map(([code, v]) => ({ code, ...v })).sort((a, b) => b.orders - a.orders), detail };
}

// ---------- newsletters ----------

export type Segment = 'all' | 'optin' | 'optout';

export async function countNewsletterRecipients(segment: Segment, paidOnly: boolean): Promise<number> {
  const db = getDb();
  const [r] = await db
    .select({ n: sql<number>`count(*)` })
    .from(customers)
    .where(and(eq(customers.status, 'active'), segment === 'optin' ? eq(customers.newsletter, true) : segment === 'optout' ? eq(customers.newsletter, false) : undefined, paidOnly ? sql`exists (select 1 from orders o where o.customer_id = ${customers.id} and o.status in ('paid', 'processing', 'shipped', 'complete'))` : undefined));
  return r?.n ?? 0;
}

export async function listNewsletterRecipients(segment: Segment, paidOnly: boolean, afterEmail: string | null, limit: number) {
  const db = getDb();
  return db
    .select({ email: customers.email, firstName: customers.firstName, lastName: customers.lastName })
    .from(customers)
    .where(and(eq(customers.status, 'active'), segment === 'optin' ? eq(customers.newsletter, true) : segment === 'optout' ? eq(customers.newsletter, false) : undefined, paidOnly ? sql`exists (select 1 from orders o where o.customer_id = ${customers.id} and o.status in ('paid', 'processing', 'shipped', 'complete'))` : undefined, afterEmail ? sql`${customers.email} > ${afterEmail}` : undefined))
    .orderBy(asc(customers.email))
    .limit(limit);
}

export async function listNewsletters() {
  return getDb().select().from(newsletters).orderBy(desc(newsletters.id)).limit(100);
}

export async function saveNewsletter(id: number | null, input: { subject: string; bodyHtml: string; segment: Segment; paidOnly: boolean }, adminEmail: string): Promise<number> {
  const db = getDb();
  if (!input.subject.trim()) throw new MarketingError('Subject is required.');
  if (!input.bodyHtml.trim()) throw new MarketingError('Body is required.');
  const row = { subject: input.subject.trim(), bodyHtml: input.bodyHtml, segment: input.segment, paidOnly: input.paidOnly };
  if (id) {
    const cur = await db.query.newsletters.findFirst({ where: eq(newsletters.id, id) });
    if (cur?.sentAt) throw new MarketingError('A sent newsletter cannot be edited; duplicate it instead.');
    await db.update(newsletters).set(row).where(eq(newsletters.id, id));
    return id;
  }
  const [r] = await db.insert(newsletters).values({ ...row, createdBy: adminEmail }).returning({ id: newsletters.id });
  return r!.id;
}

/** Sends the next batch (legacy: 20 per batch with a bookmark so an interrupted send resumes). */
export async function sendNewsletterBatch(id: number, batchSize = 20): Promise<{ sent: number; remaining: number; done: boolean }> {
  const db = getDb();
  const n = await db.query.newsletters.findFirst({ where: eq(newsletters.id, id) });
  if (!n) throw new MarketingError('Newsletter not found.');
  if (n.sentAt) return { sent: 0, remaining: 0, done: true };
  const total = n.recipientCount ?? (await countNewsletterRecipients(n.segment as Segment, n.paidOnly));
  const batch = await listNewsletterRecipients(n.segment as Segment, n.paidOnly, n.bookmark, batchSize);
  let sent = 0;
  for (const r of batch) {
    const html = n.bodyHtml.replace(/#NAME#/g, r.firstName ?? 'there').replace(/#EMAIL#/g, r.email);
    const res = await sendRendered('newsletter', r.email, { subject: n.subject, html, text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), templateData: { subject: n.subject, body: html } });
    if (res.ok) sent++;
  }
  const last = batch[batch.length - 1]?.email ?? n.bookmark;
  const done = batch.length < batchSize;
  await db
    .update(newsletters)
    .set({ recipientCount: total, sentCount: n.sentCount + sent, bookmark: done ? null : last, sentAt: done ? new Date().toISOString() : null })
    .where(eq(newsletters.id, id));
  const remaining = Math.max(0, total - (n.sentCount + sent));
  return { sent, remaining: done ? 0 : remaining, done };
}

export async function sendNewsletterPreview(id: number, to: string): Promise<boolean> {
  const n = await getDb().query.newsletters.findFirst({ where: eq(newsletters.id, id) });
  if (!n) throw new MarketingError('Newsletter not found.');
  const html = n.bodyHtml.replace(/#NAME#/g, 'Preview').replace(/#EMAIL#/g, to);
  const r = await sendRendered('newsletter', to, { subject: `[PREVIEW] ${n.subject}`, html, text: html.replace(/<[^>]+>/g, ' '), templateData: { subject: n.subject, body: html } });
  return r.ok;
}

export async function deleteNewsletter(id: number): Promise<void> {
  await getDb().delete(newsletters).where(eq(newsletters.id, id));
}

// ---------- affiliates ----------

export async function listAffiliates() {
  return getDb()
    .select({ id: affiliates.id, name: affiliates.name, slug: affiliates.slug, discountPercent: affiliates.discountPercent, active: affiliates.active, items: sql<number>`(select count(*) from affiliate_items i where i.affiliate_id = ${affiliates.id})` })
    .from(affiliates)
    .orderBy(desc(affiliates.active), asc(affiliates.name));
}

export async function getAffiliate(id: number) {
  const db = getDb();
  const a = await db.query.affiliates.findFirst({ where: eq(affiliates.id, id) });
  if (!a) return null;
  const items = await db.select().from(affiliateItems).where(eq(affiliateItems.affiliateId, id));
  const pids = items.filter((i) => i.kind === 'product').map((i) => i.itemId);
  const cids = items.filter((i) => i.kind === 'category').map((i) => i.itemId);
  const [pn, cn] = await Promise.all([
    pids.length ? db.select({ id: products.id, sku: products.sku, name: products.name }).from(products).where(inArray(products.id, pids.slice(0, 90))) : [],
    cids.length ? db.select({ id: categories.id, name: categories.name, slug: categories.slug }).from(categories).where(inArray(categories.id, cids.slice(0, 90))) : [],
  ]);
  return { affiliate: a, products: pn, categories: cn };
}

export async function getAffiliateBySlug(slug: string) {
  const db = getDb();
  const a = await db.query.affiliates.findFirst({ where: and(eq(affiliates.slug, slug), eq(affiliates.active, true)) });
  if (!a) return null;
  return getAffiliate(a.id);
}

export async function saveAffiliate(id: number | null, input: { name: string; slug: string | null; contentHtml: string | null; imageUrl: string | null; discountPercent: number; active: boolean; productIds: number[]; categoryIds: number[] }): Promise<number> {
  const db = getDb();
  const name = input.name.trim();
  if (!name) throw new MarketingError('Affiliate name is required.');
  if (input.discountPercent < 0 || input.discountPercent > 100) throw new MarketingError('Discount must be 0–100%.');
  const existing = id ? await db.query.affiliates.findFirst({ where: eq(affiliates.id, id) }) : null;
  const slug = existing ? existing.slug : slugify(input.slug?.trim() || name); // slug is fixed after creation, as on the legacy site
  if (!slug) throw new MarketingError('Slug is required.');
  const dup = await db.select({ id: affiliates.id }).from(affiliates).where(eq(affiliates.slug, slug)).limit(1);
  if (dup[0] && dup[0].id !== id) throw new MarketingError(`/aff/${slug} already exists.`);
  const row = { name, slug, contentHtml: input.contentHtml || null, imageUrl: input.imageUrl?.trim() || null, discountPercent: input.discountPercent, active: input.active };
  let affId = id;
  if (affId) await db.update(affiliates).set(row).where(eq(affiliates.id, affId));
  else {
    const [r] = await db.insert(affiliates).values(row).returning({ id: affiliates.id });
    affId = r!.id;
  }
  await db.delete(affiliateItems).where(eq(affiliateItems.affiliateId, affId));
  const rows = [...new Set(input.productIds)].map((itemId) => ({ affiliateId: affId!, kind: 'product', itemId })).concat([...new Set(input.categoryIds)].map((itemId) => ({ affiliateId: affId!, kind: 'category', itemId })));
  if (rows.length) await db.insert(affiliateItems).values(rows);
  return affId;
}

export async function deleteAffiliate(id: number): Promise<void> {
  await getDb().delete(affiliates).where(eq(affiliates.id, id));
}
