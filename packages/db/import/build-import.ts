/**
 * Builds seed chunks from the legacy export JSON (import/legacy/*.json, produced by
 * import:extract) covering the full schema: catalog, options, specs, images, related,
 * compatible SKUs, models, finders, promotions, redirects, reviews, settings, shipping,
 * locations, and (staging-only) customers and orders.
 *
 * Usage: pnpm --filter @ff/db import:build [--with-codes] [--no-customers]
 *   --with-codes     also load the 2.3M single-use promo codes (slow on remote)
 *   --no-customers   skip customers/orders (e.g. for a public demo database)
 * Then: pnpm --filter @ff/db seed:apply [--remote]
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeModel, q, slugify, SqlWriter, str, toBool, toCents, toInt, toIso, toNum } from '../seed/lib';

const here = dirname(fileURLToPath(import.meta.url));
const LEGACY = join(here, 'legacy');
const OUT_DIR = join(here, '../seed/chunks');
const WITH_CODES = process.argv.includes('--with-codes');
const NO_CUSTOMERS = process.argv.includes('--no-customers');
const IMAGE_HOST = 'https://www.filtersfast.com/ProdImages/';

type Row = Record<string, unknown>;
function load(table: string): Row[] {
  const file = join(LEGACY, `${table}.json`);
  if (!existsSync(file)) {
    console.warn(`  (no export for ${table})`);
    return [];
  }
  return (JSON.parse(readFileSync(file, 'utf8')) as { rows: Row[] }).rows;
}
const skipped: string[] = [];
const w = new SqlWriter(OUT_DIR);
w.raw('PRAGMA foreign_keys = OFF;');
for (const t of [
  'auth_verification', 'auth_session', 'auth_account', 'auth_user',
  'order_items', 'shipments', 'orders', 'cart_items', 'carts', 'product_reminders', 'customer_appliances', 'addresses', 'customers',
  'promo_codes', 'promotions', 'quantity_tiers', 'ship_rates', 'ship_methods', 'locations', 'redirects', 'reviews', 'site_settings', 'faqs',
  'model_products', 'appliance_models', 'refrigerator_finder', 'water_filter_finder', 'water_filter_sizes', 'water_filter_types', 'humidifier_finder',
  'air_filter_size_products', 'air_filter_sizes',
  'channel_prices', 'sale_restrictions',
  'compatible_skus', 'related_products', 'product_specs', 'product_images', 'product_options', 'product_option_groups', 'options', 'option_groups',
  'category_products', 'products', 'categories', 'brands',
]) w.raw(`DELETE FROM ${t};`);

/** Pack unit names per product (legacy tUnitName: "Kit", "System", "2-Pack"…); idProduct 0 rows are generic. */
const unitNames = new Map<number, string>();
for (const r of load('tUnitName')) {
  const pid = toInt(r.idProduct);
  const name = str(r.unitName);
  if (pid && name && toBool(r.uActive) && !unitNames.has(pid)) unitNames.set(pid, name);
}

// ---------- brands ----------
const products = load('products').filter((p) => {
  const ok = typeof p.idProduct === 'number' && (p.active === -1 || p.active === 0);
  if (!ok && typeof p.idProduct === 'number') skipped.push(String(p.idProduct));
  return ok;
});
const brandIds = new Map<string, number>();
for (const name of load('productManufacturers').map((r) => str(r.Manufacturer)).filter(Boolean) as string[]) brandIds.set(name, brandIds.size + 1);
for (const p of products) {
  const n = str(p.manufacture);
  if (n && !brandIds.has(n)) brandIds.set(n, brandIds.size + 1);
}
const usedBrandSlugs = new Set<string>();
w.insert(
  'brands',
  ['id', 'name', 'slug', 'active'],
  [...brandIds].map(([name, id]) => {
    let s = slugify(name) || `brand-${id}`;
    if (usedBrandSlugs.has(s)) s = `${s}-${id}`;
    usedBrandSlugs.add(s);
    return [id, name, s, true];
  }),
);

// ---------- categories ----------
const categories = load('categories').filter((c) => typeof c.idCategory === 'number');
const usedCatSlugs = new Set<string>();
const catSlugById = new Map<number, string>();
w.insert(
  'categories',
  ['id', 'parent_id', 'name', 'h1', 'slug', 'legacy_slug', 'description_html', 'short_html', 'image_url', 'meta_title', 'meta_description', 'kind', 'sort_order', 'active', 'compare_active', 'featured', 'hide_from_listings', 'category_type', 'graphic_url', 'logo_url', 'content_location'],
  categories.map((c) => {
    const id = c.idCategory as number;
    const pag = str(c.pagname);
    let s = pag ? slugify(pag.replace(/-cat\.asp$/i, '').replace(/\.asp$/i, '')) : slugify(str(c.categoryDesc) ?? '');
    if (!s) s = `category-${id}`;
    if (usedCatSlugs.has(s)) s = `${s}-${id}`;
    usedCatSlugs.add(s);
    catSlugById.set(id, s);
    const parent = toInt(c.idParentCategory);
    const img = str(c.categoryImage);
    return [
      id,
      parent && parent > 0 ? parent : null,
      str(c.categoryDesc) ?? `Category ${id}`,
      str(c.categoryH1),
      s,
      pag,
      str(c.categoryHTMLLong),
      str(c.categoryHTML)?.replace(/<br\s*\/?>/gi, '').trim() || null,
      img ? `${IMAGE_HOST}category/${img}` : null,
      str(c.metatitle),
      str(c.metadesc),
      null,
      toInt(c.sortOrder) ?? 0,
      Boolean(pag),
      toBool(c.compareActive),
      toBool(c.categoryFeatured),
      toBool(c.hideFromListings),
      str(c.categoryType),
      str(c.categoryGraphic),
      str(c.categoryLogo),
      toInt(c.categoryContentLocation),
    ];
  }),
);

// ---------- products ----------
const productIds = new Set<number>();
const usedProdSlugs = new Set<string>();
const img = (v: unknown) => {
  const s = str(v);
  return s ? (/^https?:/i.test(s) ? s : IMAGE_HOST + s.replace(/^\/?prodimages\//i, '')) : null;
};
const productRows = products.map((p) => {
  const id = p.idProduct as number;
  productIds.add(id);
  const pag = str(p.pagename);
  let s = pag ? slugify(pag.replace(/\.asp$/i, '').replace(/^p-/i, '')) : slugify(str(p.description) ?? '');
  if (!s) s = `product-${id}`;
  if (usedProdSlugs.has(s)) s = `${s}-${id}`;
  usedProdSlugs.add(s);
  const price = toCents(p.price) ?? 0;
  const list = toCents(p.listPrice);
  const stock = toInt(p.stock) ?? 0;
  const brand = str(p.manufacture);
  const fam = str(p.familyDesignation)?.toLowerCase();
  const packUom = toInt(p.packSizeUOM) ?? 1;
  const packMult = toBool(p.packMultFlag) || toInt(p.packMultFlag) === 3;
  const weightLb = toNum(p.weight);
  const altKind = toInt(p.discontinuedAltType);
  return [
    id,
    str(p.sku) ?? `SKU-${id}`,
    str(p.manufacturesku),
    str(p.description) ?? `Product ${id}`,
    s,
    pag,
    brand ? brandIds.get(brand) ?? null : null,
    brand,
    str(p.details),
    str(p.descriptionLong),
    str(p.relatedKeys),
    price,
    list && list > price ? list : null,
    null, // as_low_as_cents computed below from tiers
    img(p.imageURL),
    img(p.smallImageURL),
    stock,
    toBool(p.ignoreStock),
    toInt(p.leadTime),
    toBool(p.dropShip),
    str(p.blockedReason)?.toUpperCase() ?? null,
    toBool(p.hotDeal),
    toInt(p.homePage) ?? 0,
    toInt(p.recommendedfrequency),
    (toInt(p.RecommendedProd) ?? 0) > 0 ? toInt(p.RecommendedProd) : null,
    fam === 'oem' || fam === 'compatible' ? fam : null,
    toInt(p.packSize) && toInt(p.packSize)! > 0 ? toInt(p.packSize) : null,
    toInt(p.maxCartQty) && toInt(p.maxCartQty)! > 0 ? toInt(p.maxCartQty) : null,
    toBool(p.showPriceInCart),
    toInt(p.retExclude) ?? 0,
    str(p.upc),
    (toInt(p.idPaired) ?? 0) > 0 ? toInt(p.idPaired) : null,
    (toInt(p.compareDefaultOption) ?? 0) > 0 ? toInt(p.compareDefaultOption) : null,
    (toInt(p.discontinuedAlternative) ?? 0) > 0 ? toInt(p.discontinuedAlternative) : null,
    (toInt(p.discontinuedAlternative) ?? 0) > 0 ? (altKind === 0 || altKind === null ? 'product' : 'category') : null,
    str(p.discontinuedText),
    (toInt(p.tempUnavailableAlternative) ?? 0) > 0 ? toInt(p.tempUnavailableAlternative) : null,
    str(p.tempUnavailableText),
    toBool(p.fridgeFilter),
    toBool(p.ffAirFilter),
    toBool(p.ffWaterFilter),
    toBool(p.humidifierFilter),
    toBool(p.homeAirFilter),
    toBool(p.guaranteeBadge),
    !toBool(p.siteSearchDisable),
    toBool(p.noShipCharge),
    toBool(p.privateLabel),
    packMult && packUom > 1 ? packUom : 1,
    unitNames.get(id) ?? (packMult && packUom > 1 ? 'pack' : null),
    toBool(p.AutoShipEnabled),
    (toInt(p.CompareTo) ?? 0) > 0 ? toInt(p.CompareTo) : null,
    (toInt(p.compareToAlt) ?? 0) > 0 ? toInt(p.compareToAlt) : null,
    toInt(p.poprank) ?? 9999,
    weightLb !== null ? Math.round(weightLb * 16 * 100) / 100 : null,
    toBool(p.prop65),
    toBool(p.madeInUSA),
    toBool(p.taxExempt),
    p.active === -1,
    str(p.metatitle),
    str(p.metadesc),
  ];
});
const PRODUCT_COLS = [
  'id', 'sku', 'manufacturer_sku', 'name', 'slug', 'legacy_slug', 'brand_id', 'brand_name', 'description_html', 'short_description', 'search_keywords',
  'price_cents', 'list_price_cents', 'as_low_as_cents', 'image_url', 'thumb_url', 'stock', 'ignore_stock', 'lead_time_days', 'drop_ship', 'blocked_reason',
  'hot_deal', 'home_page_rank', 'recommended_frequency_months', 'recommended_product_id', 'family_designation', 'pack_size', 'max_cart_qty', 'hide_price',
  'return_policy_code', 'upc', 'parent_product_id', 'compare_default_option_id', 'discontinued_alternative_id', 'discontinued_alternative_kind', 'discontinued_text',
  'temp_unavailable_alternative_id', 'temp_unavailable_text', 'is_fridge_filter', 'is_ff_air_filter', 'is_ff_water_filter', 'is_humidifier_filter', 'is_home_air_filter',
  'guarantee_badge', 'searchable', 'free_shipping', 'private_label', 'pack_qty', 'pack_uom', 'autoship_enabled', 'compare_to_id', 'compare_to_alt_id', 'pop_rank',
  'weight_oz', 'prop65', 'made_in_usa', 'tax_exempt', 'active', 'meta_title', 'meta_description',
];
w.insert('products', PRODUCT_COLS, productRows);

// quantity tiers (DiscProd) + as-low-as
const tiers = load('DiscProd').filter((t) => productIds.has(toInt(t.idProduct) ?? -1));
const maxDisc = new Map<number, number>();
w.insert(
  'quantity_tiers',
  ['product_id', 'from_qty', 'to_qty', 'discount_cents', 'discount_percent', 'source'],
  tiers.map((t) => {
    const pid = toInt(t.idProduct)!;
    const amt = toCents(t.discAmt) ?? 0;
    maxDisc.set(pid, Math.max(maxDisc.get(pid) ?? 0, amt));
    const to = toInt(t.discToQty);
    return [pid, toInt(t.discFromQty) ?? 1, to && to < 1000 ? to : null, amt, toNum(t.discPerc) ?? 0, str(t.source)];
  }),
);
for (const [pid, disc] of maxDisc) {
  if (disc > 0) w.raw(`UPDATE products SET as_low_as_cents = MAX(0, price_cents - ${disc}) WHERE id = ${pid} AND price_cents > ${disc};`);
}

// ---------- category_products ----------
const catIds = new Set(categories.map((c) => c.idCategory as number));
const cpSeen = new Set<string>();
const cpRows: unknown[][] = [];
for (const r of load('Categories_Products')) {
  const pid = toInt(r.idProduct);
  const cid = toInt(r.idCategory);
  if (!pid || !cid || !productIds.has(pid) || !catIds.has(cid)) continue;
  const key = `${cid}:${pid}`;
  if (cpSeen.has(key)) continue;
  cpSeen.add(key);
  cpRows.push([cid, pid, 0]);
}
w.insert('category_products', ['category_id', 'product_id', 'sort_order'], cpRows as (string | number | null)[][]);

// ---------- options ----------
w.insert(
  'option_groups',
  ['id', 'name', 'display_type', 'required', 'sizing_link'],
  load('optionsGroups')
    .filter((g) => typeof g.idOptionGroup === 'number')
    .map((g) => [g.idOptionGroup as number, str(g.optionGroupDesc) ?? 'Options', str(g.optionType) === 'R' ? 'radio' : 'select', toBool(g.optionReq), str(g.sizingLink)]),
);
const optionIds = new Set<number>();
w.insert(
  'options',
  ['id', 'group_id', 'label', 'price_add_cents', 'percent_add', 'sort_order'],
  (() => {
    const groupOf = new Map<number, number>();
    for (const x of load('optionsXref')) if (toInt(x.idOption) && toInt(x.idOptionGroup)) groupOf.set(toInt(x.idOption)!, toInt(x.idOptionGroup)!);
    return load('options')
      .filter((o) => typeof o.idOption === 'number' && groupOf.has(o.idOption as number))
      .map((o) => {
        optionIds.add(o.idOption as number);
        return [o.idOption as number, groupOf.get(o.idOption as number)!, str(o.optionDescrip) ?? '', toCents(o.priceToAdd) ?? 0, toNum(o.percToAdd) ?? 0, toInt(o.sortOrder) ?? 0];
      });
  })(),
);
w.insert(
  'product_option_groups',
  ['product_id', 'group_id', 'sort_order'],
  load('optionsGroupsXref')
    .filter((x) => productIds.has(toInt(x.idProduct) ?? -1) && toInt(x.idOptionGroup))
    .map((x) => [toInt(x.idProduct)!, toInt(x.idOptionGroup)!, 0]),
  'IGNORE',
);
const inv = load('productOptionInventory');
const excl = load('OptionsProdEx');
const prices = load('OptionsPrices');
const po = new Map<string, { productId: number; optionId: number; stock: number | null; excluded: boolean; price: number | null; sku: string | null; image: string | null }>();
const poKey = (p: number, o: number) => `${p}:${o}`;
const poGet = (p: number, o: number) => {
  const k = poKey(p, o);
  if (!po.has(k)) po.set(k, { productId: p, optionId: o, stock: null, excluded: false, price: null, sku: null, image: null });
  return po.get(k)!;
};
for (const r of load('product_option_images')) if (productIds.has(toInt(r.idProduct) ?? -1) && optionIds.has(toInt(r.idOption) ?? -1) && str(r.optionImageUrl)) poGet(toInt(r.idProduct)!, toInt(r.idOption)!).image = img(r.optionImageUrl);
for (const r of inv) if (productIds.has(toInt(r.idProduct) ?? -1) && optionIds.has(toInt(r.idOption) ?? -1)) Object.assign(poGet(toInt(r.idProduct)!, toInt(r.idOption)!), { stock: toBool(r.Unavailable) || toBool(r.Blocked) ? 0 : toInt(r.stock) });
for (const r of excl) if (productIds.has(toInt(r.idProduct) ?? -1) && optionIds.has(toInt(r.idOption) ?? -1)) poGet(toInt(r.idProduct)!, toInt(r.idOption)!).excluded = true;
for (const r of prices) if (productIds.has(toInt(r.idProduct) ?? -1) && optionIds.has(toInt(r.idOption) ?? -1)) poGet(toInt(r.idProduct)!, toInt(r.idOption)!).price = toCents(r.optPrice);
w.insert(
  'product_options',
  ['product_id', 'option_id', 'sku', 'stock', 'excluded', 'price_override_cents', 'image_url'],
  [...po.values()].map((v) => [v.productId, v.optionId, v.sku, v.stock, v.excluded, v.price, v.image]),
);

// ---------- sale restrictions (legacy sale_restrictions: country, optional state) ----------
const restrictionRows: unknown[][] = [];
const restrictionSeen = new Set<string>();
for (const r of load('sale_restrictions')) {
  const pid = toInt(r.idProduct);
  const country = (str(r.blockedCountry) ?? '').toUpperCase().replace(/^UK$/, 'GB');
  const region = (str(r.blockedState) ?? '').toUpperCase() || null;
  if (!pid || !productIds.has(pid) || !/^[A-Z]{2}$/.test(country)) continue;
  const k = `${pid}:${country}:${region ?? ''}`;
  if (restrictionSeen.has(k)) continue;
  restrictionSeen.add(k);
  restrictionRows.push([pid, country, region]);
}
w.insert('sale_restrictions', ['product_id', 'country', 'region'], restrictionRows as (string | number | null)[][]);

// ---------- channel / campaign prices (legacy tsourceprice) ----------
w.insert(
  'channel_prices',
  ['product_id', 'option_id', 'source', 'price_cents', 'ad_medium', 'price_date'],
  load('tsourceprice')
    .filter((r) => productIds.has(toInt(r.idproduct) ?? -1) && str(r.source) && toCents(r.price) !== null)
    .map((r) => [toInt(r.idproduct)!, toInt(r.idOption) || null, str(r.source)!, toCents(r.price)!, str(r.adMedium), toIso(r.priceDate)]),
);

// ---------- images ----------
const imageRows: unknown[][] = [];
for (const r of load('product_images')) {
  const pid = toInt(r.idProduct);
  const url = str(r.imageUrl);
  if (!pid || !url || !productIds.has(pid)) continue;
  imageRows.push([pid, img(url), null, toInt(r.imgSortOrder) ?? 0]);
}
w.insert('product_images', ['product_id', 'url', 'alt', 'sort_order'], imageRows as (string | number | null)[][]);

// ---------- specs (wide → name/value) ----------
const SPEC_LABELS: Record<string, string> = {
  filterLifeMonths: 'Filter Life (Months)', filterLifeMonthsTo: 'Filter Life Up To (Months)', merv: 'MERV Rating', micron: 'Micron Rating', mediaType: 'Media Type',
  material: 'Material', flowRate: 'Flow Rate (GPM)', voltage: 'Voltage', diameter: 'Diameter', top: 'Top', bottomDiameter: 'Bottom Diameter', length: 'Length',
  weight: 'Weight', surfaceArea: 'Surface Area', filterPercent: 'Efficiency (%)', efficiency: 'Efficiency', connectionType: 'Connection Type', iceCount: 'Ice Count',
};
const SPEC_FLAGS: Record<string, string> = {
  nsf42: 'NSF/ANSI 42 Certified', nsf53: 'NSF/ANSI 53 Certified', lead: 'Reduces Lead', mercury: 'Reduces Mercury', dust: 'Captures Dust', pollen: 'Captures Pollen',
  moldSpores: 'Captures Mold Spores', petDander: 'Captures Pet Dander', antimicrobial: 'Antimicrobial', smokeSmog: 'Captures Smoke & Smog', allergens: 'Captures Allergens',
  bacteria: 'Reduces Bacteria', virusCarriers: 'Captures Virus Carriers', charcoalAir: 'Activated Carbon', sediment: 'Reduces Sediment', silt: 'Reduces Silt', scale: 'Reduces Scale',
  wireHarness: 'Wire Harness Included', incDirections: 'Instructions Included', n95: 'N95', n99: 'N99', bpaFree: 'BPA Free', badtaste: 'Reduces Bad Taste', chlorine: 'Reduces Chlorine',
  odor: 'Reduces Odor', disposable: 'Disposable', replaceFilter: 'Replaceable Filter',
};
const specRows: unknown[][] = [];
// Typed attributes (legacy productTypeAttribute/…Value: "Filter Life (Months)", "Flow Rate gpm", …) come first;
// Brand (1) and Part Number (2) are already in the PDP header.
const attrNames = new Map<number, { name: string; suffix: string }>();
for (const a of load('productTypeAttribute')) {
  const id = toInt(a.attributeID);
  const name = (str(a.attributeName) ?? '').replace(/:$/, '').trim();
  if (id && name) attrNames.set(id, { name, suffix: (str(a.valueSuffix) ?? '').replace('&deg;', '°') });
}
const attrSeen = new Set<string>();
for (const r of load('productTypeAttributeValue')) {
  const pid = toInt(r.idProduct);
  const aid = toInt(r.attributeID);
  const v = str(r.attributeValue);
  const a = aid ? attrNames.get(aid) : undefined;
  if (!pid || !aid || !a || !v || !productIds.has(pid) || aid <= 2) continue;
  const k = `${pid}:${aid}`;
  if (attrSeen.has(k)) continue;
  attrSeen.add(k);
  specRows.push([pid, a.name, a.suffix ? `${v} ${a.suffix}`.trim() : v, aid]);
  attrSeen.add(`${pid}|${a.name}`);
}
// Faceting dimensions (legacy prod_dim_codes/values + productDimensions) that read as specs.
const DIM_LABELS: Record<string, string> = { MICRON: 'Micron Rating', MERVRATING: 'MERV Rating', MEDIATYPE: 'Media Type', HEIGHT: 'Height', WIDTH: 'Width', LENGTH: 'Length', DEPTH: 'Depth', APPLICATION: 'Application' };
const dimValues = new Map<number, { label: string; value: string }>();
for (const r of load('prod_dim_values')) {
  const id = toInt(r.idVal);
  const label = DIM_LABELS[(str(r.code) ?? '').toUpperCase()];
  const value = str(r.codeName) ?? str(r.codeVal);
  if (id && label && value) dimValues.set(id, { label, value });
}
for (const r of load('productDimensions')) {
  const pid = toInt(r.idProduct);
  const d = dimValues.get(toInt(r.idVal) ?? -1);
  if (!pid || !d || !productIds.has(pid)) continue;
  const k = `${pid}|${d.label}`;
  if (attrSeen.has(k)) continue;
  attrSeen.add(k);
  specRows.push([pid, d.label, d.value, 50]);
}
for (const r of load('productSpecs')) {
  const pid = toInt(r.idProduct);
  if (!pid || !productIds.has(pid)) continue;
  let order = 100;
  for (const [col, label] of Object.entries(SPEC_LABELS)) {
    const v = r[col];
    if (v === null || v === undefined || v === '' || v === 0 || v === '0') continue;
    if (attrSeen.has(`${pid}|${label}`)) continue; // same fact already came from the typed attributes
    specRows.push([pid, label, String(v), order++]);
  }
  for (const [col, label] of Object.entries(SPEC_FLAGS)) if (toBool(r[col])) specRows.push([pid, label, 'Yes', order++]);
}
w.insert('product_specs', ['product_id', 'name', 'value', 'sort_order'], specRows as (string | number | null)[][]);

// ---------- air-filter sizes (legacy search_products → listbysize2.asp) ----------
/** "08x08x1" → "8x8x1" with the smallest number as depth, then height ≤ width (same key as @ff/domain parseAirFilterSize). */
function sizeKeyOf(s: string): { key: string; h: number; w: number; d: number } | null {
  const nums = s.toLowerCase().split(/\s*x\s*/).map((p) => Number.parseFloat(p));
  if (nums.length < 2 || nums.some((n) => !Number.isFinite(n))) return null;
  const [d = 1, h = 0, w = 0] = [...(nums.length === 2 ? [1, ...nums] : nums)].sort((a, b) => a - b);
  if (!h || !w) return null;
  const f = (n: number) => String(n);
  return { key: `${f(h)}x${f(w)}x${f(d)}`, h, w, d };
}
const sizeMap = new Map<string, { h: number; w: number; d: number; active: boolean }>();
const sizeProductRows: unknown[][] = [];
for (const r of load('search_products')) {
  const pid = toInt(r.idProduct);
  const size = sizeKeyOf(str(r.size) ?? '');
  if (!pid || !size || !productIds.has(pid)) continue;
  const active = toBool(r.sizeActive);
  const cur = sizeMap.get(size.key) ?? { h: size.h, w: size.w, d: size.d, active: false };
  cur.active = cur.active || active;
  sizeMap.set(size.key, cur);
  const oid = toInt(r.idOption);
  sizeProductRows.push([toInt(r.filterId), size.key, pid, oid && optionIds.has(oid) ? oid : null, str(r.type), str(r.brand), active, toInt(r.row) ?? 0, toInt(r.column) ?? 0]);
}
w.insert('air_filter_sizes', ['key', 'height_x100', 'width_x100', 'depth_x100', 'active'], [...sizeMap].map(([key, v]) => [key, Math.round(v.h * 100), Math.round(v.w * 100), Math.round(v.d * 100), v.active]));
w.insert('air_filter_size_products', ['id', 'size_key', 'product_id', 'option_id', 'merv', 'brand', 'active', 'row', 'col'], sizeProductRows as (string | number | boolean | null)[][], 'IGNORE');

// ---------- related / compare / groups ----------
const relSeen = new Set<string>();
const relRows: unknown[][] = [];
const addRel = (a: number, b: number, kind: string, order = 0) => {
  if (!productIds.has(a) || !productIds.has(b) || a === b) return;
  const k = `${a}:${b}:${kind}`;
  if (relSeen.has(k)) return;
  relSeen.add(k);
  relRows.push([a, b, kind, order]);
};
for (const r of load('RelatedProductsXref')) addRel(toInt(r.idProduct) ?? 0, toInt(r.relatedIdProduct) ?? 0, 'related', toInt(r.sortOrder) ?? 0);
for (const p of products) {
  for (const k of ['related1', 'related2', 'related3']) if ((toInt(p[k]) ?? 0) > 0) addRel(p.idProduct as number, toInt(p[k])!, 'related', 99);
  if ((toInt(p.CompareTo) ?? 0) > 0) addRel(p.idProduct as number, toInt(p.CompareTo)!, 'compare', toInt(p.CompareToSortOrder) ?? 0);
  if ((toInt(p.compareToAlt) ?? 0) > 0) addRel(p.idProduct as number, toInt(p.compareToAlt)!, 'compare', 50);
}
for (const r of load('productGroups')) addRel(toInt(r.prodGroupP) ?? 0, toInt(r.prodGroupC) ?? 0, 'group');
w.insert('related_products', ['product_id', 'related_product_id', 'kind', 'sort_order'], relRows as (string | number | null)[][]);

// ---------- compatible SKUs ----------
w.insert(
  'compatible_skus',
  ['product_id', 'brand', 'sku', 'sku_normalized'],
  load('productCompSkuList')
    .filter((r) => productIds.has(toInt(r.idProduct) ?? -1) && str(r.skuValue))
    .map((r) => [toInt(r.idProduct)!, str(r.skuBrand) ?? '', str(r.skuValue)!, normalizeModel(str(r.skuValue)!)]),
);

// ---------- appliance models ----------
const modelIdByNumber = new Map<string, number>();
const modelRows: unknown[][] = [];
const modelProductRows: unknown[][] = [];
const mpSeen = new Set<string>();
for (const r of load('tFridgeModelLookup')) {
  const raw = r.FridgeModelNumber;
  const number = raw === null || raw === undefined ? '' : String(raw).trim();
  const pid = toInt(r.idProduct);
  if (!number || !pid || !productIds.has(pid)) continue;
  const key = number.toUpperCase();
  let mid = modelIdByNumber.get(key);
  if (!mid) {
    mid = modelIdByNumber.size + 1;
    modelIdByNumber.set(key, mid);
    modelRows.push([mid, number, normalizeModel(number), str(r.Manufacturer), str(r.Category), toBool(r.noindex)]);
  }
  const k = `${mid}:${pid}`;
  if (mpSeen.has(k)) continue;
  mpSeen.add(k);
  modelProductRows.push([mid, pid, 'compatible', 0]);
}
w.insert('appliance_models', ['id', 'model_number', 'normalized', 'brand_name', 'appliance_type', 'noindex'], modelRows as (string | number | null)[][]);
w.insert('model_products', ['model_id', 'product_id', 'relation', 'sort_order'], modelProductRows as (string | number | null)[][]);

// ---------- finders ----------
w.insert(
  'refrigerator_finder',
  ['brand_category_id', 'style_id', 'style_name', 'location_id', 'location_name', 'removal_id', 'removal_name', 'removal_image_url', 'product_id', 'alt_product_id_1', 'alt_product_id_2', 'active'],
  load('refrigerator_finder')
    .filter((r) => toInt(r.idBrand) && toInt(r.idProduct))
    .map((r) => [toInt(r.idBrand)!, toInt(r.idStyle) ?? 0, str(r.styleDesc) ?? '', toInt(r.idLoc) ?? 0, str(r.locDesc) ?? '', toInt(r.idRemove) ?? 0, str(r.removeDesc) ?? '', str(r.altRemovalImg), toInt(r.idProduct)!, (toInt(r.altprod1) ?? 0) > 0 ? toInt(r.altprod1) : null, (toInt(r.altprod2) ?? 0) > 0 ? toInt(r.altprod2) : null, toBool(r.active)]),
);
w.insert('water_filter_types', ['id', 'name', 'image_url', 'active'], load('tWaterFilterType').filter((r) => toInt(r.idType)).map((r) => [toInt(r.idType)!, str(r.typeDesc) ?? '', str(r.typeImg), toBool(r.active)]));
w.insert('water_filter_sizes', ['type_id', 'length', 'width', 'image_url'], load('tWaterFilterSize').filter((r) => toInt(r.idType)).map((r) => [toInt(r.idType)!, toNum(r.length) ?? 0, toNum(r.width) ?? 0, str(r.sizeImg)]));
w.insert('water_filter_finder', ['category_id', 'type_id', 'length', 'width', 'micron', 'product_id', 'active'], load('tWaterFilterFinder').filter((r) => toInt(r.idCat) && toInt(r.idProduct)).map((r) => [toInt(r.idCat)!, toInt(r.idType) ?? 0, toNum(r.len) ?? 0, toNum(r.wid) ?? 0, toNum(r.micron), toInt(r.idProduct)!, toBool(r.active)]));
w.insert('humidifier_finder', ['category_id', 'length', 'width', 'thickness', 'product_id'], load('tHumidifierFinder').filter((r) => toInt(r.idCat) && toInt(r.idProduct)).map((r) => [toInt(r.idCat)!, toNum(r.len) ?? 0, toNum(r.wid) ?? 0, toNum(r.thick), toInt(r.idProduct)!]));

// ---------- promotions ----------
const yyyymmdd = (v: unknown) => {
  const s = str(v)?.replace(/\D/g, '');
  return s && s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null;
};
w.insert(
  'promotions',
  ['id', 'code', 'tag', 'title', 'status', 'percent_off', 'amount_off_cents', 'min_subtotal_cents', 'max_subtotal_cents', 'valid_from', 'valid_to', 'once_only', 'free_shipping', 'exclusive', 'compoundable', 'allow_on_forms', 'scope_kind', 'scope_ref', 'match_value', 'gift_with_purchase', 'bogo', 'tiered', 'legacy_json'],
  load('DiscOrder')
    .filter((d) => typeof d.idDiscOrder === 'number')
    .map((d) => [
      d.idDiscOrder as number, str(d.discCode), str(d.discTag), str(d.discTitle), str(d.discStatus) === 'A' ? 'active' : 'inactive', toNum(d.discPerc), toCents(d.discAmt),
      toCents(d.discFromAmt), toCents(d.discToAmt), yyyymmdd(d.discValidFrom), yyyymmdd(d.discValidTo), toBool(d.discOnceOnly), toBool(d.discFreeShipping), toBool(d.exclusiveDiscount),
      toBool(d.isCompoundable), d.allowOnForms === null || d.allowOnForms === undefined ? true : toBool(d.allowOnForms), toInt(d.promoItemFlag) ?? 0, toInt(d.promoItemDisc), str(d.discMatchValue),
      toBool(d.giftWithPurchaseFlag), toBool(d.bogoFlag), toBool(d.tieredSaleFlag), JSON.stringify(d),
    ]),
);
if (WITH_CODES) {
  const codeSeen = new Set<string>();
  const codes: unknown[][] = [];
  for (const c of load('tDiscCode')) {
    const code = str(c.discCode);
    const tag = str(c.discTag);
    if (!code || !tag || codeSeen.has(code)) continue;
    codeSeen.add(code);
    codes.push([code, tag, str(c.discStatus) === 'A' ? 'active' : 'inactive']);
  }
  w.insert('promo_codes', ['code', 'tag', 'status'], codes as (string | number | null)[][], 'IGNORE');
}

// ---------- content: reviews, redirects, settings ----------
w.insert(
  'reviews',
  ['id', 'product_id', 'source', 'external_id', 'rating', 'title', 'body', 'author_name', 'verified', 'created_at', 'approved'],
  load('reviews')
    .filter((r) => typeof r.idReview === 'number' && productIds.has(toInt(r.idProduct) ?? -1))
    .map((r) => [r.idReview as number, toInt(r.idProduct)!, 'legacy', String(r.idReview), Math.min(5, Math.max(1, toInt(r.revRating) ?? 5)), str(r.revSubj), str(r.revDetail), str(r.revName), false, toIso(r.revDate) ?? '2010-01-01T00:00:00.000Z', str(r.revStatus) === 'A']),
);
const redirectRows: unknown[][] = [];
const redirSeen = new Set<string>();
const addRedirect = (from: string, to: string, kind: string) => {
  const f = from.startsWith('/') ? from : `/${from}`;
  if (redirSeen.has(f.toLowerCase()) || f.toLowerCase() === to.toLowerCase()) return;
  redirSeen.add(f.toLowerCase());
  redirectRows.push([f, to, 301, kind]);
};
const prodSlugByPagename = new Map<string, string>();
products.forEach((p, i) => {
  const pag = str(p.pagename);
  if (pag) prodSlugByPagename.set(pag.toLowerCase(), productRows[i]![4] as string);
});
for (const r of load('prodRedirect')) {
  if (!toBool(r.rStatus)) continue;
  const oldP = str(r.oldPagename);
  const newP = str(r.newPagename);
  if (!oldP || !newP) continue;
  const target = prodSlugByPagename.get(newP.toLowerCase()) ?? slugify(newP.replace(/\.asp$/i, '').replace(/^p-/i, ''));
  addRedirect(oldP.replace(/\.asp$/i, '') + '.asp', `/p/${target}`, 'product');
  if (!/\.asp$/i.test(oldP)) addRedirect(oldP, `/p/${target}`, 'product');
}
for (const r of load('catRedirect')) {
  if (!toBool(r.rStatus)) continue;
  const oldP = str(r.oldPagename);
  const newP = str(r.newPagename);
  if (!oldP || !newP) continue;
  const cat = categories.find((c) => str(c.pagname)?.toLowerCase() === newP.toLowerCase());
  const target = cat ? catSlugById.get(cat.idCategory as number)! : slugify(newP.replace(/-cat\.asp$/i, '').replace(/\.asp$/i, ''));
  addRedirect(oldP, `/c/${target}`, 'category');
}
for (const r of load('redirectHub_models')) {
  const kw = str(r.keyword);
  if (kw) addRedirect(`/filters/${kw}`, `/models/${encodeURIComponent(kw.toUpperCase())}`, 'keyword');
}
w.insert('redirects', ['from_path', 'to_path', 'status', 'kind'], redirectRows as (string | number | null)[][], 'IGNORE');

const SECRET_KEYS = new Set(['authNetLogin', 'authNetTxKey', 'TwoCheckoutMD5', 'MERC_ID', 'MERC_PIN', 'NochexMemberID', 'payPalMemberID', 'TwoCheckOutSID']);
const settingRows: unknown[][] = [];
for (const r of load('storeAdmin')) {
  const key = str(r.configVar);
  if (!key || SECRET_KEYS.has(key)) continue;
  const val = str(r.configVal);
  if (key === 'controlRec') continue; // the *|* blob; positions with secrets, and the named rows already carry the useful values
  if (val !== null) settingRows.push([`legacy.${key}`, JSON.stringify(val), 'Imported from storeAdmin']);
}
for (const r of load('mods')) {
  for (const [k, v] of Object.entries(r)) if (k !== 'ModID' && v !== null && v !== undefined) settingRows.push([`legacy.mods.${k}`, JSON.stringify(typeof v === 'string' && /^-?\d+$/.test(v) ? Number(v) : v), 'Imported from mods (legacy site switches)']);
}
settingRows.push(['shipping.freeThresholdCents', '9900', 'Free economy shipping threshold (legacy pFreeShipThresh)']);
w.insert('site_settings', ['key', 'value', 'description'], settingRows as (string | number | null)[][]);

// ---------- shipping / locations ----------
w.insert('ship_methods', ['id', 'name', 'active'], load('ShipMethod').filter((r) => toInt(r.idShipMethod)).map((r) => [toInt(r.idShipMethod)!, str(r.shipDesc) ?? '', str(r.status) === 'A']));
w.insert(
  'ship_rates',
  ['id', 'method_id', 'zone', 'unit_type', 'units_from', 'units_to', 'add_amount_cents', 'add_percent'],
  load('shipRates').filter((r) => toInt(r.idShip) && toInt(r.idShipMethod)).map((r) => [toInt(r.idShip)!, toInt(r.idShipMethod)!, toInt(r.locShipZone) ?? 0, str(r.unitType) ?? 'W', toNum(r.unitsFrom) ?? 0, toNum(r.unitsTo) ?? 0, toCents(r.addAmt) ?? 0, toNum(r.addPerc) ?? 0]),
);
const locSeen = new Set<string>();
w.insert(
  'locations',
  ['id', 'name', 'country', 'region', 'tax_rate', 'ship_zone', 'active'],
  load('Locations')
    .filter((r) => toInt(r.idLocation) && str(r.locCountry))
    .filter((r) => {
      const k = `${str(r.locCountry)}|${str(r.locState) ?? ''}`.toUpperCase();
      if (locSeen.has(k)) return false;
      locSeen.add(k);
      return true;
    })
    .map((r) => [toInt(r.idLocation)!, str(r.locName) ?? '', str(r.locCountry)!.toUpperCase(), str(r.locState)?.toUpperCase() ?? null, (toNum(r.locTax) ?? 0) / (toNum(r.locTax)! > 1 ? 100 : 1), toInt(r.locShipZone), str(r.locStatus) === 'A']),
);

// ---------- customers / orders (staging export only) ----------
if (!NO_CUSTOMERS) {
  const customers = load('customer').filter((c) => typeof c.idCust === 'number' && str(c.email));
  const custIds = new Set<number>();
  const emailSeen = new Set<string>();
  const custRows: unknown[][] = [];
  const addrRows: unknown[][] = [];
  for (const c of customers) {
    const email = str(c.email)!.toLowerCase();
    if (emailSeen.has(email)) continue;
    emailSeen.add(email);
    const id = c.idCust as number;
    custIds.add(id);
    const hash = str(c.password);
    custRows.push([
      id, email, str(c.name), str(c.lastName), str(c.phone), str(c.customerCompany),
      hash ? (toIso(c.secConvDt) ? 'sha256' : 'rc4') : 'none', hash, toBool(c.newsletter), toBool(c.futureSMS), toBool(c.isEmployee), toBool(c.isMilitary),
      toInt(c.remindin), toBool(c.guestAccount), toIso(c.dateCreated) ?? '2010-01-01T00:00:00.000Z',
    ]);
    if (str(c.address) && str(c.city)) addrRows.push([id, str(c.name), str(c.lastName), str(c.customerCompany), str(c.address)!, null, str(c.city)!, str(c.locState)?.toUpperCase() ?? '', str(c.zip) ?? '', str(c.locCountry)?.toUpperCase() ?? 'US', str(c.phone), false, true]);
    if (str(c.shippingAddress) && str(c.shippingCity)) addrRows.push([id, str(c.shippingName), str(c.shippingLastName), null, str(c.shippingAddress)!, null, str(c.shippingCity)!, str(c.shippingLocState)?.toUpperCase() ?? '', str(c.shippingZip) ?? '', str(c.shippingLocCountry)?.toUpperCase() ?? 'US', str(c.shippingPhone), true, false]);
  }
  w.insert('customers', ['id', 'email', 'first_name', 'last_name', 'phone', 'company', 'legacy_hash_type', 'legacy_hash', 'newsletter', 'sms_opt_in', 'is_employee', 'is_military', 'reminder_months', 'guest', 'created_at'], custRows as (string | number | null)[][]);

  // Better Auth identities for legacy customers with a password: the credential account carries
  // `legacy:<sha256|rc4>:<hex>` until the first successful sign-in re-hashes it (see packages/domain/src/legacy-password.ts).
  const nowMs = Date.now();
  const authUsers: unknown[][] = [];
  const authAccounts: unknown[][] = [];
  for (const c of custRows) {
    const [id, email, first, last, , , hashType, hash, , , , , , guest, createdAt] = c as [number, string, string | null, string | null, unknown, unknown, string, string | null, unknown, unknown, unknown, unknown, unknown, boolean, string];
    if (guest || !hash || hashType === 'none') continue;
    const uid = `legacy-${id}`;
    const created = Date.parse(createdAt) || nowMs;
    authUsers.push([uid, [first, last].filter(Boolean).join(' ') || email, email, false, null, id, Math.floor(created / 1000), Math.floor(nowMs / 1000)]);
    authAccounts.push([`legacy-acct-${id}`, uid, 'credential', uid, `legacy:${hashType}:${String(hash).toUpperCase()}`, Math.floor(created / 1000), Math.floor(nowMs / 1000)]);
  }
  w.insert('auth_user', ['id', 'name', 'email', 'email_verified', 'image', 'customer_id', 'created_at', 'updated_at'], authUsers as (string | number | boolean | null)[][], 'IGNORE');
  w.insert('auth_account', ['id', 'account_id', 'provider_id', 'user_id', 'password', 'created_at', 'updated_at'], authAccounts as (string | number | null)[][], 'IGNORE');
  w.insert('addresses', ['customer_id', 'first_name', 'last_name', 'company', 'line1', 'line2', 'city', 'region', 'postal_code', 'country', 'phone', 'is_default_shipping', 'is_default_billing'], addrRows as (string | number | null)[][]);
  w.insert('customer_appliances', ['customer_id', 'model_id'], load('customer_models').filter((r) => custIds.has(toInt(r.idCust) ?? -1) && toInt(r.idModel)).map((r) => [toInt(r.idCust)!, toInt(r.idModel)!]));
  w.insert('product_reminders', ['customer_id', 'product_id', 'option_id', 'order_id', 'months', 'active'], load('product_order_reminders').filter((r) => custIds.has(toInt(r.idCust) ?? -1) && productIds.has(toInt(r.idProduct) ?? -1)).map((r) => [toInt(r.idCust)!, toInt(r.idProduct)!, toInt(r.idOption), toInt(r.idOrder), toInt(r.remindIn) ?? 6, toBool(r.remindActive)]));

  const STATUS: Record<string, string> = { '1': 'processing', '2': 'complete', '7': 'complete', '9': 'refunded' };
  const heads = load('cartHead').filter((h) => typeof h.idOrder === 'number' && str(h.email));
  const orderIds = new Set<number>();
  const addr = (h: Row, p: string) => ({
    firstName: str(h[`${p}Name`] ?? h.name) ?? '', lastName: str(h[`${p}LastName`] ?? h.lastName) ?? '', company: str(h.customerCompany) ?? undefined,
    line1: str(h[`${p}Address`] ?? h.address) ?? '', city: str(h[`${p}City`] ?? h.city) ?? '', region: str(h[`${p}LocState`] ?? h.locState)?.toUpperCase() ?? '',
    postalCode: str(h[`${p}Zip`] ?? h.zip) ?? '', country: str(h[`${p}LocCountry`] ?? h.locCountry)?.toUpperCase() ?? 'US', phone: str(h[`${p}Phone`] ?? h.phone) ?? undefined,
  });
  w.insert(
    'orders',
    ['id', 'number', 'legacy_order_id', 'customer_id', 'email', 'status', 'currency', 'subtotal_cents', 'discount_cents', 'shipping_cents', 'tax_cents', 'donation_cents', 'total_cents', 'billing_address', 'shipping_address', 'shipping_method', 'payment_provider', 'promo_codes', 'access_key', 'placed_at'],
    heads.map((h) => {
      const id = h.idOrder as number;
      orderIds.add(id);
      const billing = addr(h, '');
      const shipping = str(h.shippingAddress) ? addr(h, 'shipping') : billing;
      const cust = toInt(h.idCust);
      return [
        id, `L${id}`, id, cust && custIds.has(cust) ? cust : null, str(h.email)!.toLowerCase(), STATUS[String(h.orderStatus)] ?? 'complete', str(h.intCurrency) ?? 'USD',
        toCents(h.subTotal) ?? 0, (toCents(h.discTotal) ?? 0) + (toCents(h.promoDiscAmt) ?? 0), toCents(h.shipmentTotal) ?? 0, toCents(h.taxTotal) ?? 0, toCents(h.donationAmount) ?? 0, toCents(h.Total) ?? 0,
        JSON.stringify(billing), JSON.stringify(shipping), str(h.shipmentMethod), str(h.paymentType)?.toLowerCase() ?? null,
        JSON.stringify([str(h.discCode), str(h.promoDiscCode)].filter(Boolean)), str(h.randomKey) ?? `legacy-${id}`, toIso(h.orderDate) ?? '2020-01-01T00:00:00.000Z',
      ];
    }),
  );
  const optLabel = new Map<number, string>();
  for (const o of load('cartRowsOptions')) if (toInt(o.idCartRow) && str(o.optionDescrip)) optLabel.set(toInt(o.idCartRow)!, str(o.optionDescrip)!);
  w.insert(
    'order_items',
    ['id', 'order_id', 'product_id', 'sku', 'name', 'option_label', 'qty', 'unit_price_cents', 'discount_cents', 'subscription_months', 'custom_sku', 'returnable'],
    load('cartRows')
      .filter((r) => typeof r.idCartRow === 'number' && orderIds.has(toInt(r.idOrder) ?? -1))
      .map((r) => [r.idCartRow as number, toInt(r.idOrder)!, productIds.has(toInt(r.idProduct) ?? -1) ? toInt(r.idProduct) : null, str(r.sku) ?? '', str(r.description) ?? '', optLabel.get(r.idCartRow as number) ?? null, toInt(r.quantity) ?? 1, toCents(r.unitPrice) ?? 0, toCents(r.discAmt) ?? 0, toBool(r.autoshipFlag) ? toInt(r.subFreq) : null, str(r.customSKU), !toBool(r.custom)]),
  );
  w.insert('shipments', ['order_id', 'carrier', 'tracking_number', 'shipped_at'], load('tShipHistory').filter((s) => orderIds.has(toInt(s.idorder) ?? -1) && str(s.track)).map((s) => [toInt(s.idorder)!, str(s.ServiceType), str(s.track)!, toIso(s.ShipDate)]));
}

w.raw('PRAGMA foreign_keys = ON;');
const files = w.write();
console.log(`\n${files} chunk files written to ${OUT_DIR}`);
console.log(`products ${productRows.length} (skipped ${skipped.length} malformed rows${skipped.length ? ': ' + skipped.slice(0, 15).join(', ') + (skipped.length > 15 ? '…' : '') : ''})`);
console.log(`categories ${categories.length}, category links ${cpRows.length}, options ${optionIds.size}, product-option rows ${po.size}, images ${imageRows.length}, specs ${specRows.length}`);
console.log(`related ${relRows.length}, models ${modelRows.length}, model links ${modelProductRows.length}, redirects ${redirectRows.length}, promotions ${load('DiscOrder').length}, tiers ${tiers.length}${WITH_CODES ? ' (+ promo codes)' : ' (promo codes skipped; --with-codes)'}`);
