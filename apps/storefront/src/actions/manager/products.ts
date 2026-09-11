import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { parseModelLines, parsePartLines } from '@ff/domain/models';
import { levelFor, requireArea } from '~/lib/manager/permissions';
import {
  addCompatibleSkus,
  addModels,
  copyProduct,
  createProduct,
  deleteProduct,
  mergeCompatibleSkusToParent,
  mergeModelsToParent,
  ProductError,
  removeCompatibleSku,
  removeModel,
  saveCompareSpecs,
  saveProductOption,
  setProductCategories,
  setProductImages,
  setProductOptionGroup,
  setProductSpecs,
  setQuantityTiers,
  setRelatedProducts,
  setSaleRestrictions,
  updateProduct,
  updateProductPricing,
  type ProductInput,
} from '~/lib/manager/products';
import { dollarsToCents, toBool, toInt, toNum } from '~/lib/manager/util';

const fail = (e: unknown): never => {
  if (e instanceof ProductError) throw new ActionError({ code: 'BAD_REQUEST', message: e.field ? JSON.stringify({ message: e.message, field: e.field }) : e.message });
  throw new ActionError({ code: 'BAD_REQUEST', message: e instanceof Error ? e.message : 'Something went wrong' });
};

/** Products may be written at level 1 (full) or level 2 (restricted: pricing only). */
function requireProductWrite(ctx: { locals: App.Locals }): { admin: App.Locals['admin'] & object; restricted: boolean } {
  const admin = requireArea(ctx, 'Products', 0);
  const level = levelFor(admin, 'Products');
  if (level !== 1 && level !== 2) throw new ActionError({ code: 'FORBIDDEN', message: 'You need full or restricted control of "Products" to change products.' });
  return { admin, restricted: level === 2 };
}

const idList = (v: unknown): number[] =>
  String(v ?? '')
    .split(/[,\s|]+/)
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0);

/** Maps the big editor form (all strings) onto ProductInput. */
function productInputFromForm(f: Record<string, unknown>): ProductInput {
  const s = (k: string) => (f[k] === null || f[k] === undefined ? null : String(f[k]));
  return {
    sku: s('sku') ?? '',
    name: s('name') ?? '',
    slug: s('slug'),
    brandName: s('brandName'),
    manufacturerSku: s('manufacturerSku'),
    upc: s('upc'),
    active: toBool(f.active),
    hidden: toBool(f.hidden),
    searchable: toBool(f.searchable),
    priceCents: dollarsToCents(s('price')) ?? 0,
    listPriceCents: dollarsToCents(s('listPrice')),
    mapCents: dollarsToCents(s('map')),
    costCents: dollarsToCents(s('cost')),
    ogPriceCents: dollarsToCents(s('ogPrice')),
    dimFeeCents: dollarsToCents(s('dimFee')),
    weightOz: toNum(s('weightOz')),
    stock: toInt(s('stock')),
    ignoreStock: toBool(f.ignoreStock),
    leadTimeDays: toInt(s('leadTimeDays')),
    dropShip: toBool(f.dropShip),
    blockedReason: s('blockedReason'),
    hotDeal: toBool(f.hotDeal),
    homePageRank: toInt(s('homePageRank'), 0),
    freeShipping: toBool(f.freeShipping),
    discountedShipping: toBool(f.discountedShipping),
    freeProduct: toBool(f.freeProduct),
    giftWithPurchaseId: toInt(s('giftWithPurchaseId')),
    prop65: toBool(f.prop65),
    madeInUsa: toBool(f.madeInUsa),
    taxExempt: toBool(f.taxExempt),
    privateLabel: toBool(f.privateLabel),
    hidePrice: toBool(f.hidePrice),
    guaranteeBadge: toBool(f.guaranteeBadge),
    showUnaffiliated: toBool(f.showUnaffiliated),
    includeInFeed: toBool(f.includeInFeed),
    feedOverride: toBool(f.feedOverride),
    autoshipEnabled: toBool(f.autoshipEnabled),
    recommendedFrequencyMonths: toInt(s('recommendedFrequencyMonths')),
    returnPolicyCode: toInt(s('returnPolicyCode'), 0) ?? 0,
    packQty: toInt(s('packQty'), 1),
    packSize: toInt(s('packSize')),
    packUom: s('packUom'),
    maxCartQty: toInt(s('maxCartQty')),
    familyDesignation: s('familyDesignation'),
    parentProductId: toInt(s('parentProductId')),
    compareToId: toInt(s('compareToId')),
    compareToAltId: toInt(s('compareToAltId')),
    compareSortOrder: toInt(s('compareSortOrder'), 1) ?? 1,
    compareDefaultOptionId: toInt(s('compareDefaultOptionId')),
    replacementForId: toInt(s('replacementForId')),
    recommendedProductId: toInt(s('recommendedProductId')),
    discontinuedAlternativeId: toInt(s('discontinuedAlternativeId')),
    discontinuedAlternativeKind: s('discontinuedAlternativeKind'),
    discontinuedText: s('discontinuedText'),
    tempUnavailableAlternativeId: toInt(s('tempUnavailableAlternativeId')),
    tempUnavailableText: s('tempUnavailableText'),
    isFridgeFilter: toBool(f.isFridgeFilter),
    isFfAirFilter: toBool(f.isFfAirFilter),
    isFfWaterFilter: toBool(f.isFfWaterFilter),
    isHumidifierFilter: toBool(f.isHumidifierFilter),
    isHomeAirFilter: toBool(f.isHomeAirFilter),
    googleCategory: s('googleCategory'),
    navItemNo: s('navItemNo'),
    descriptionHtml: s('descriptionHtml'),
    shortDescription: s('shortDescription'),
    searchKeywords: s('searchKeywords'),
    comparisonText: s('comparisonText'),
    metaTitle: s('metaTitle'),
    metaDescription: s('metaDescription'),
    metaKeywords: s('metaKeywords'),
    imageUrl: s('imageUrl'),
    thumbUrl: s('thumbUrl'),
  };
}

const withId = z.object({ productId: z.number().int().positive() });

export const productActions = {
  /** Full save (level 1) or pricing-only save (level 2). */
  saveProduct: defineAction({
    accept: 'form',
    input: z.object({ productId: z.number().int().nonnegative() }).catchall(z.any()),
    handler: async (input, ctx) => {
      const { admin, restricted } = requireProductWrite(ctx);
      const form = input as Record<string, unknown>;
      try {
        if (restricted) {
          if (!input.productId) throw new ActionError({ code: 'FORBIDDEN', message: 'Restricted control cannot create products.' });
          await updateProductPricing(input.productId, { priceCents: dollarsToCents(String(form.price ?? '')) ?? 0, listPriceCents: dollarsToCents(String(form.listPrice ?? '')), costCents: dollarsToCents(String(form.cost ?? '')) }, admin.email);
          return { ok: true, id: input.productId, created: false };
        }
        const data = productInputFromForm(form);
        if (input.productId) {
          await updateProduct(input.productId, data, admin.email);
          return { ok: true, id: input.productId, created: false };
        }
        const id = await createProduct(data, admin.email);
        return { ok: true, id, created: true };
      } catch (e) {
        return fail(e);
      }
    },
  }),

  copyProduct: defineAction({
    accept: 'form',
    input: withId.extend({ sku: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(250) }),
    handler: async ({ productId, sku, name }, ctx) => {
      const admin = requireArea(ctx, 'Products', 1);
      try {
        return { ok: true, id: await copyProduct(productId, sku, name, admin.email) };
      } catch (e) {
        return fail(e);
      }
    },
  }),

  deleteProduct: defineAction({
    accept: 'form',
    input: withId.extend({ confirm: z.string().trim() }),
    handler: async ({ productId, confirm }, ctx) => {
      requireArea(ctx, 'Products', 1);
      if (confirm !== String(productId)) throw new ActionError({ code: 'BAD_REQUEST', message: 'Type the product id to confirm deletion.' });
      try {
        await deleteProduct(productId);
      } catch (e) {
        return fail(e);
      }
      return { ok: true };
    },
  }),

  saveProductCategories: defineAction({
    accept: 'form',
    input: withId.extend({ categoryIds: z.string().nullish() }),
    handler: async ({ productId, categoryIds }, ctx) => {
      requireArea(ctx, 'Products', 1);
      await setProductCategories(productId, idList(categoryIds));
      return { ok: true };
    },
  }),

  saveProductImages: defineAction({
    accept: 'form',
    input: withId.extend({ imageUrl: z.string().trim().max(500).nullish(), thumbUrl: z.string().trim().max(500).nullish(), gallery: z.string().max(5000).nullish() }),
    handler: async ({ productId, imageUrl, thumbUrl, gallery }, ctx) => {
      requireArea(ctx, 'Products', 1);
      const { getDb } = await import('~/lib/db');
      const { products } = await import('@ff/db');
      const { eq } = await import('drizzle-orm');
      await getDb().update(products).set({ imageUrl: imageUrl || null, thumbUrl: thumbUrl || null, updatedAt: new Date().toISOString() }).where(eq(products.id, productId));
      await setProductImages(productId, String(gallery ?? '').split(/\r?\n/));
      return { ok: true };
    },
  }),

  saveProductSpecs: defineAction({
    accept: 'form',
    input: withId.extend({ specs: z.string().max(20000).nullish() }),
    handler: async ({ productId, specs }, ctx) => {
      requireArea(ctx, 'Products', 1);
      const rows = String(specs ?? '')
        .split(/\r?\n/)
        .map((l) => l.split(/\s*[:|\t]\s*/))
        .filter((p) => p.length >= 2)
        .map((p) => ({ name: p[0]!, value: p.slice(1).join(': ') }));
      await setProductSpecs(productId, rows);
      return { ok: true };
    },
  }),

  saveQuantityTiers: defineAction({
    accept: 'form',
    input: withId.catchall(z.any()),
    handler: async (input, ctx) => {
      const { admin } = requireProductWrite(ctx);
      const f = input as Record<string, unknown>;
      const tiers = [];
      for (let i = 0; i < 20; i++) {
        const from = toInt(f[`from${i}`]);
        if (!from) continue;
        tiers.push({ fromQty: from, toQty: toInt(f[`to${i}`]), discountCents: dollarsToCents(String(f[`amount${i}`] ?? '')) ?? 0, discountPercent: toNum(f[`percent${i}`], 0) ?? 0 });
      }
      try {
        await setQuantityTiers(input.productId, tiers, admin.email);
      } catch (e) {
        return fail(e);
      }
      return { ok: true };
    },
  }),

  addCompatibleSkus: defineAction({
    accept: 'form',
    input: withId.extend({ lines: z.string().max(50000), brand: z.string().trim().max(80).nullish() }),
    handler: async ({ productId, lines, brand }, ctx) => {
      requireArea(ctx, 'Products', 1);
      const n = await addCompatibleSkus(productId, parsePartLines(lines, brand ?? ''));
      return { ok: true, added: n };
    },
  }),

  removeCompatibleSku: defineAction({
    accept: 'form',
    input: withId.extend({ id: z.number().int().positive() }),
    handler: async ({ productId, id }, ctx) => {
      requireArea(ctx, 'Products', 1);
      await removeCompatibleSku(productId, id);
      return { ok: true };
    },
  }),

  mergePartsToParent: defineAction({
    accept: 'form',
    input: withId,
    handler: async ({ productId }, ctx) => {
      requireArea(ctx, 'Products', 1);
      try {
        return { ok: true, moved: await mergeCompatibleSkusToParent(productId) };
      } catch (e) {
        return fail(e);
      }
    },
  }),

  addModels: defineAction({
    accept: 'form',
    input: withId.extend({ lines: z.string().max(100000), manufacturer: z.string().trim().max(80).nullish(), category: z.string().trim().max(80).nullish(), relation: z.enum(['compatible', 'oem', 'accessory']).default('compatible') }),
    handler: async ({ productId, lines, manufacturer, category, relation }, ctx) => {
      requireArea(ctx, 'Products', 1);
      const r = await addModels(productId, parseModelLines(lines, { manufacturer: manufacturer ?? '', category: category ?? '' }), relation);
      return { ok: true, ...r };
    },
  }),

  removeModel: defineAction({
    accept: 'form',
    input: withId.extend({ modelId: z.number().int().positive() }),
    handler: async ({ productId, modelId }, ctx) => {
      requireArea(ctx, 'Products', 1);
      await removeModel(productId, modelId);
      return { ok: true };
    },
  }),

  mergeModelsToParent: defineAction({
    accept: 'form',
    input: withId,
    handler: async ({ productId }, ctx) => {
      requireArea(ctx, 'Products', 1);
      try {
        return { ok: true, moved: await mergeModelsToParent(productId) };
      } catch (e) {
        return fail(e);
      }
    },
  }),

  saveCompareSpecs: defineAction({
    accept: 'form',
    input: withId.extend({ compareType: z.number().int().nonnegative() }).catchall(z.any()),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Products', 1);
      try {
        await saveCompareSpecs(input.productId, input.compareType, input as Record<string, unknown>);
      } catch (e) {
        return fail(e);
      }
      return { ok: true };
    },
  }),

  saveRelatedProducts: defineAction({
    accept: 'form',
    input: withId.extend({ relatedIds: z.string().max(2000).nullish() }),
    handler: async ({ productId, relatedIds }, ctx) => {
      requireArea(ctx, 'Products', 1);
      await setRelatedProducts(productId, idList(relatedIds));
      return { ok: true };
    },
  }),

  setProductOptionGroup: defineAction({
    accept: 'form',
    input: withId.extend({ groupId: z.number().int().nullish() }),
    handler: async ({ productId, groupId }, ctx) => {
      requireArea(ctx, 'Products', 1);
      try {
        await setProductOptionGroup(productId, groupId && groupId > 0 ? groupId : null);
      } catch (e) {
        return fail(e);
      }
      return { ok: true };
    },
  }),

  saveProductOption: defineAction({
    accept: 'form',
    input: withId.extend({ optionId: z.number().int().positive(), excluded: z.boolean().default(false), stock: z.string().trim().max(10).nullish(), priceOverride: z.string().trim().max(12).nullish(), optionSku: z.string().trim().max(60).nullish(), imageUrl: z.string().trim().max(500).nullish() }),
    handler: async ({ productId, optionId, excluded, stock, priceOverride, optionSku, imageUrl }, ctx) => {
      requireArea(ctx, 'Products', 1);
      await saveProductOption(productId, optionId, { excluded, stock: toInt(stock), priceOverrideCents: dollarsToCents(priceOverride), sku: optionSku || null, imageUrl: imageUrl || null });
      return { ok: true };
    },
  }),

  saveSaleRestrictions: defineAction({
    accept: 'form',
    input: withId.extend({ lines: z.string().max(10000).nullish() }),
    handler: async ({ productId, lines }, ctx) => {
      requireArea(ctx, 'Products', 1);
      const rows = String(lines ?? '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [country, region] = l.split(/[\s,/-]+/);
          return { country: country ?? '', region: region ?? null };
        });
      await setSaleRestrictions(productId, rows);
      return { ok: true };
    },
  }),
};
