import { inArray, sql } from 'drizzle-orm';
import { categories, products } from '@ff/db';
import { slugify } from '@ff/domain/urls';
import { getDb } from './db';

/**
 * Header mega-menu, ported from the legacy `_INCheader.asp` flyouts (inventory 03 §4).
 *
 * The curation (which brands get a logo tile, which SKUs and sizes are "Most Popular") is
 * editorial and lives here; every link is resolved against D1 at render time so a renamed
 * or retired category/product silently drops out instead of 404ing. The imported `pop_rank`
 * has hundreds of ties at rank 1 and is not a usable popularity signal, so the lists stay
 * hand-picked as on the live site.
 */

export interface NavLogo {
  src: string;
  width: number;
  height: number;
}

export interface NavLink {
  label: string;
  href: string;
  logo?: NavLogo;
}

export interface NavColumn {
  title: string;
  /** list = stacked text links; logos = brand tiles; grid = two-column text links */
  layout: 'list' | 'logos' | 'grid';
  links: NavLink[];
  viewAll?: NavLink;
}

export interface NavFlyout {
  key: string;
  label: string;
  href: string;
  image?: { src: string; alt: string; caption: string };
  columns: NavColumn[];
}

export interface MoreTab {
  key: string;
  label: string;
  groups: { title?: string; links: NavLink[] }[];
  promo: { src: string; caption: string };
}

export interface NavModel {
  items: NavFlyout[];
  more: { label: string; tabs: MoreTab[]; sale: NavLink };
}

// ---------- spec (legacy paths and SKUs; resolved below) ----------

type CatRef = { cat: string; label?: string; logo?: NavLogo };
type SkuRef = { sku: string; label: string };
type SizeRef = { size: string };
type Ref = CatRef | SkuRef | SizeRef;

interface ColumnSpec {
  title: string;
  layout: NavColumn['layout'];
  items: Ref[];
  viewAll?: { cat: string; label: string };
}

interface FlyoutSpec {
  key: string;
  label: string;
  cat: string;
  image?: NavFlyout['image'];
  columns: ColumnSpec[];
}

const logo = (file: string, width: number, height: number): NavLogo => ({ src: `/nav/${file}`, width, height });

const FRIDGE: FlyoutSpec = {
  key: 'fridge',
  label: 'Refrigerator Filters',
  cat: '/Refrigerator-Water-Filters-cat.asp',
  image: { src: '/nav/fridgefilters.jpg', alt: 'Refrigerator water filters', caption: 'Refrigerator Water Filters Certified for NSF Standards' },
  columns: [
    {
      title: 'Most Popular',
      layout: 'list',
      items: [
        { sku: 'RPWFE', label: 'RPWFE' },
        { sku: 'EDR3RXD1', label: 'EDR3RXD1' },
        { sku: 'XWFE', label: 'XWFE' },
        { sku: 'EDR1RXD1', label: 'EDR1RXD1' },
        { sku: 'LT-1000P', label: 'LT-1000P' },
        { sku: 'ULTRAWF', label: 'ULTRAWF' },
        { sku: 'EDR4RXD1', label: 'EDR4RXD1' },
      ],
    },
    {
      title: 'Choose by Brand',
      layout: 'logos',
      items: [
        { cat: '/Whirlpool-Replacement-Refrigerator-Water-Filter-Cat.asp', label: 'Whirlpool' },
        { cat: '/Maytag-Refrigerator-Water-Filters-cat.asp', label: 'Maytag', logo: logo('maytag-logo.png', 127, 127) },
        { cat: '/GE-Refrigerator-Water-Filters-cat.asp', label: 'GE', logo: logo('ge-logo.png', 127, 85) },
        { cat: '/Samsung-Refrigerator-Water-Filters-cat.asp', label: 'Samsung', logo: logo('samsung-logo.png', 127, 127) },
        { cat: '/Frigidaire-Refrigerator-Water-Filters-cat.asp', label: 'Frigidaire', logo: logo('frigidaire-logo.png', 127, 127) },
        { cat: '/Kenmore-Refrigerator-Water-Filters-cat.asp', label: 'Kenmore', logo: logo('kenmore-logo.png', 127, 127) },
        { cat: '/LG-Refrigerator-Water-Filters-cat.asp', label: 'LG', logo: logo('lg-logo.png', 127, 85) },
        { cat: '/kitchenaid-Refrigerator-Water-Filters-cat.asp', label: 'KitchenAid', logo: logo('kitchenaid-logo.png', 127, 127) },
      ],
      viewAll: { cat: '/Refrigerator-Water-Filters-cat.asp', label: 'View All Brands' },
    },
  ],
};

const AIR: FlyoutSpec = {
  key: 'air',
  label: 'Air Filters',
  cat: '/Air-Filters-Purifiers-cat.asp',
  image: { src: '/nav/airfilters.jpg', alt: 'Air filters', caption: 'Furnace & AC Filters in Every Size' },
  columns: [
    {
      title: 'Most Popular',
      layout: 'list',
      items: ['20x20x1', '20x25x1', '16x25x1', '20x30x1', '16x20x1', '24x30x1', '30x32x2'].map((size) => ({ size })),
    },
    {
      title: 'Choose by Brand',
      layout: 'logos',
      items: [
        { cat: '/Filters-Fast-Air-Filters-cat.asp', label: 'Filters Fast Air', logo: logo('FiltersFast-logo.png', 96, 21) },
        { cat: '/Aprilaire-Air-Filters-cat.asp', label: 'AprilAire', logo: logo('aprilaire-logo.png', 96, 45) },
        { cat: '/Honeywell-Air-Filters-cat.asp', label: 'Honeywell', logo: logo('honeywell-logo.png', 96, 54) },
        { cat: '/Trion-Air-Filters-cat.asp', label: 'Trion', logo: logo('trion-logo.png', 96, 22) },
        { cat: '/Lennox-Air-Filters-cat.asp', label: 'Lennox', logo: logo('lennox-logo.png', 96, 32) },
        { cat: '/3m-filtrete-air-filters-cat.asp', label: 'Filtrete', logo: logo('filtrete-logo.png', 96, 22) },
        { cat: '/Carrier-Air-Filters-cat.asp', label: 'Carrier', logo: logo('carrier-corp-logo.png', 96, 38) },
        { cat: '/Bryant-Air-Filters-cat.asp', label: 'Bryant', logo: logo('bryant-logo.png', 96, 58) },
        { cat: '/Trane-Air-Filters-cat.asp', label: 'Trane', logo: logo('trane-logo.png', 96, 32) },
        { cat: '/GeneralAire-Air-Filters-cat.asp', label: 'Generalaire', logo: logo('generalaire-logo.png', 96, 24) },
      ],
      viewAll: { cat: '/Air-Filters-Purifiers-cat.asp', label: 'View All Brands' },
    },
  ],
};

const POOL: FlyoutSpec = {
  key: 'pool',
  label: 'Pool & Spa Filters',
  cat: '/Pool-Spa-Filters-cat.asp',
  image: { src: '/nav/spa-filters.jpeg', alt: 'Pool and spa filters', caption: 'Pool & Spa Filter Cartridges' },
  columns: [
    {
      title: 'Choose by Pool Filter Brand',
      layout: 'logos',
      items: [
        { cat: '/Hayward-Waterway-Pool-and-Spa-Filters-cat.asp', label: 'Hayward', logo: logo('FF-Hayward-Logo-2x.png', 103, 16) },
        { cat: '/Pentair-Pool-And-Spa-cat.asp', label: 'Pentair', logo: logo('FF-Pentair-Logo-2x.png', 103, 26) },
        { cat: '/Intex-Pool-and-Spa-Filters-cat.asp', label: 'Intex', logo: logo('intex-recreation-corp-logo-vector.png', 103, 21) },
        { cat: '/waterway-pool-spa-filters-cat.asp', label: 'Waterway', logo: logo('waterway_plastics_logo.jpg', 77, 77) },
        { cat: '/Jandy-Pool-and-Spa-Filters-cat.asp', label: 'Jandy', logo: logo('jandylogo.jpg', 103, 40) },
        { cat: '/Sta-Rite-Pool-and-Spa-Filters-cat.asp', label: 'Sta-Rite', logo: logo('sta-rite_logo.jpg', 75, 77) },
      ],
      viewAll: { cat: '/Pool-Spa-Filters-cat.asp', label: 'View All Pool Brands' },
    },
    {
      title: 'Choose by Spa Filter Brand',
      layout: 'logos',
      items: [
        { cat: '/master-spas-spa-hot-tub-filters-cat.asp', label: 'Master Spas', logo: logo('master-spas-logo.jpg', 103, 34) },
        { cat: '/bullfrog-spas-spa-hot-tub-filters-cat.asp', label: 'Bullfrog', logo: logo('bullfrog-logo.png', 103, 30) },
        { cat: '/pleatco-spa-hot-tub-filters-cat.asp', label: 'Pleatco', logo: logo('Pleatco-Logo-Ace.webp', 103, 28) },
        { cat: '/sundance-spa-spa-hot-tub-filters-cat.asp', label: 'Sundance', logo: logo('sundance-logo.png', 103, 34) },
        { cat: '/coleman-spa-hot-tub-filters-cat.asp', label: 'Coleman', logo: logo('coleman-spas-logo.png', 103, 24) },
        { cat: '/hot-springs-spa-hot-tub-filters-cat.asp', label: 'Hot Spring', logo: logo('hot-spring-logo.png', 103, 30) },
      ],
      viewAll: { cat: '/spa-hot-tub-filters-cat.asp', label: 'View All Spa Brands' },
    },
  ],
};

const WATER: FlyoutSpec = {
  key: 'water',
  label: 'Water Filters',
  cat: '/water-filters-cat.asp',
  image: { src: '/nav/waterfilter.jpg', alt: 'Water filters', caption: 'Cleaner Water for Every Tap' },
  columns: [
    {
      title: 'Most Popular',
      layout: 'list',
      items: [
        { cat: '/Ametek-Pentek-US-Water-Filters-cat.asp', label: 'Pentek' },
        { cat: '/Filters-Fast-Water-Filters-cat.asp', label: 'Filters Fast®' },
        { cat: '/Everpure-filters-cat.asp', label: 'Everpure' },
        { cat: '/Aqua-Pure-Water-Filters-cat.asp', label: '3M Aqua-Pure' },
        { cat: '/Watts-Flomatic-Water-Filters-cat.asp', label: 'Watts' },
        { cat: '/Dupont-filters-cat.asp', label: 'DuPont' },
      ],
    },
    {
      title: 'Choose by Type',
      layout: 'grid',
      items: [
        { cat: '/Whole-House-Water-Filters-cat.asp', label: 'Whole House Filters' },
        { cat: '/Under-Sink-Water-Filters-cat.asp', label: 'Under Sink Filters' },
        { cat: '/counter-top-filters-cat.asp', label: 'Counter Top Filters' },
        { cat: '/Pitcher-Water-Filters-cat.asp', label: 'Pitcher Filters' },
        { cat: '/Reverse-Osmosis-Water-Filters-cat.asp', label: 'Reverse Osmosis Filters' },
        { cat: '/Sink-Water-Faucet-Water-Filters-cat.asp', label: 'Faucet Filters' },
        { cat: '/Shower-Water-Filters-cat.asp', label: 'Shower Filters' },
        { cat: '/In-line-Refrigerator-Water-Filters-cat.asp', label: 'Universal / Inline Filters' },
        { cat: '/3m-RV-Marine-Filters-cat.asp', label: 'RV / Marine Filters' },
      ],
      viewAll: { cat: '/water-filters-cat.asp', label: 'View All' },
    },
  ],
};

const HUMIDIFIER: FlyoutSpec = { key: 'humidifier', label: 'Humidifier Filters', cat: '/Humidifier-Filters-cat.asp', columns: [] };

interface MoreTabSpec {
  key: string;
  label: string;
  groups: { title?: string; items: CatRef[] }[];
  promo: { src: string; caption: string };
}

const MORE_TABS: MoreTabSpec[] = [
  {
    key: 'replacement',
    label: 'Replacement Filters',
    promo: { src: '/nav/breathe-better.jpg', caption: 'Breathe Better. Drink Cleaner.' },
    groups: [
      {
        items: [
          { cat: '/Furnace-Filters-cat.asp', label: 'Furnace Filters' },
          { cat: '/coffee-filters-cat.asp', label: 'Coffee Filters' },
          { cat: '/Aquarium-Filters-cat.asp', label: 'Aquarium Filters' },
          { cat: '/Car-Air-Filters-cat.asp', label: 'Car Air Filters' },
          { cat: '/air-purifier-filters-cat.asp', label: 'Air Purifier Filters' },
          { cat: '/ice-machine-water-filters-cat.asp', label: 'Ice Machine Water Filters' },
          { cat: '/Oven-Filters-cat.asp', label: 'Range Hood Filters' },
          { cat: '/vacuum-filters-cat.asp', label: 'Vacuum Filters' },
          { cat: '/Refrigerator-Air-Filters-cat.asp', label: 'Refrigerator Air Filters' },
          { cat: '/Microwave-filters-cat.asp', label: 'Microwave Filters' },
        ],
      },
    ],
  },
  {
    key: 'systems',
    label: 'Filtration Systems',
    promo: { src: '/nav/fresh-filters.jpg', caption: 'Fresh Filters. Cleaner Air.' },
    groups: [
      {
        items: [
          { cat: '/Air-Purifiers-cat.asp', label: 'Air Purifiers' },
          { cat: '/humidifiers-cat.asp', label: 'Humidifiers' },
          { cat: '/De-Humidifiers-and-de-humidifier-parts-cat.asp', label: 'Dehumidifiers' },
          { cat: '/whole-house-water-filter-systems-cat.asp', label: 'Whole House Water Filter Systems' },
          { cat: '/under-sink-water-filter-systems-cat.asp', label: 'Under Sink Water Filter Systems' },
          { cat: '/reverse-osmosis-filter-systems-cat.asp', label: 'Reverse Osmosis Filter Systems' },
          { cat: '/counter-top-water-filter-systems-cat.asp', label: 'Countertop Water Filter Systems' },
          { cat: '/gravity-water-filter-systems-cat.asp', label: 'Gravity Water Filter Systems' },
          { cat: '/ultraviolet-water-treatment-cat.asp', label: 'UV Water Treatment' },
          { cat: '/UV-Air-Treatment-cat.asp', label: 'UV Air Treatment' },
        ],
      },
    ],
  },
  {
    key: 'more',
    label: 'and More!',
    promo: { src: '/nav/breathe-better.jpg', caption: 'Breathe Better. Drink Cleaner.' },
    groups: [
      {
        title: 'Featured Categories',
        items: [
          { cat: '/parts-accessories-cat.asp', label: 'Appliance Parts' },
          { cat: '/sump-pumps-cat.asp', label: 'Sump Pumps' },
          { cat: '/Pet-Animal-Products-Water-Filters-cat.asp', label: 'Pet Products' },
          { cat: '/pond-water-pumps-cat.asp', label: 'Pond Water Pumps' },
          { cat: '/air-filtration-masks-cat.asp', label: 'Air Filtration Masks' },
          { cat: '/Home-Wellness-cat.asp', label: 'Home Wellness' },
          { cat: '/personal-care-cat.asp', label: 'Personal Care' },
        ],
      },
      {
        title: 'Home Essentials',
        items: [
          { cat: '/Icemakers-cat.asp', label: 'Ice Makers' },
          { cat: '/Thermostat-cat.asp', label: 'Thermostats' },
          { cat: '/filtered-shower-heads-cat.asp', label: 'Filtered Shower Heads' },
          { cat: '/water-softeners-cat.asp', label: 'Water Softeners' },
          { cat: '/faucets-cat.asp', label: 'Faucets' },
          { cat: '/pitchers-cat.asp', label: 'Pitchers' },
          { cat: '/water-test-kit-cat.asp', label: 'Water Test Kits' },
          { cat: '/3m-Vacuum-Filters-Bags-cat.asp', label: 'Vacuum Bags' },
          { cat: '/leak-detectors-cat.asp', label: 'Leak Detectors' },
          { cat: '/inline-shower-filters-cat.asp', label: 'Inline Shower Filters' },
        ],
      },
    ],
  },
];

const SALE: CatRef = { cat: '/overstock-items-cat.asp', label: 'Sale' };

/** Legacy `isPoolSeason`: March 20 – September 19 puts Pool & Spa before Water and Humidifier last. */
export function isPoolSeason(now = new Date()): boolean {
  const m = now.getMonth() + 1;
  const d = now.getDate();
  return (m > 3 || (m === 3 && d >= 20)) && (m < 9 || (m === 9 && d < 20));
}

function specOrder(now: Date): FlyoutSpec[] {
  return isPoolSeason(now) ? [FRIDGE, AIR, POOL, WATER, HUMIDIFIER] : [FRIDGE, AIR, HUMIDIFIER, WATER, POOL];
}

// ---------- resolution ----------

const CACHE_MS = 10 * 60 * 1000;
let cache: { at: number; season: boolean; model: NavModel } | undefined;

export async function getNav(now = new Date()): Promise<NavModel> {
  const season = isPoolSeason(now);
  if (cache && cache.season === season && Date.now() - cache.at < CACHE_MS) return cache.model;
  const model = await buildNav(now);
  cache = { at: Date.now(), season, model };
  return model;
}

const chunk = <T>(arr: T[], size: number): T[][] => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));
const legacyKey = (path: string) => path.replace(/^\//, '').toLowerCase();
const slugKey = (path: string) => slugify(path.replace(/^\//, '').replace(/-cat\.asp$/i, ''));

async function buildNav(now: Date): Promise<NavModel> {
  const specs = specOrder(now);
  const catRefs: string[] = [];
  const skuRefs: string[] = [];
  const collect = (items: Ref[]) => {
    for (const it of items) {
      if ('cat' in it) catRefs.push(it.cat);
      else if ('sku' in it) skuRefs.push(it.sku);
    }
  };
  for (const s of specs) {
    catRefs.push(s.cat);
    for (const c of s.columns) {
      collect(c.items);
      if (c.viewAll) catRefs.push(c.viewAll.cat);
    }
  }
  for (const t of MORE_TABS) for (const g of t.groups) collect(g.items);
  catRefs.push(SALE.cat);

  const db = getDb();
  // D1 allows at most 100 bound parameters per statement: look the ~90 paths up in batches.
  const legacyKeys = [...new Set(catRefs.map(legacyKey))];
  const slugKeys = [...new Set(catRefs.map(slugKey))];
  const catQuery = (where: ReturnType<typeof inArray>) => db.select({ slug: categories.slug, name: categories.name, legacySlug: categories.legacySlug }).from(categories).where(where);
  const [catBatches, skuRows] = await Promise.all([
    Promise.all([
      ...chunk(legacyKeys, 80).map((keys) => catQuery(inArray(sql`lower(${categories.legacySlug})`, keys))),
      ...chunk(slugKeys, 80).map((keys) => catQuery(inArray(categories.slug, keys))),
    ]),
    skuRefs.length
      ? db
          .select({ sku: products.sku, slug: products.slug })
          .from(products)
          .where(sql`upper(${products.sku}) in (${sql.join(skuRefs.map((s) => sql`${s.toUpperCase()}`), sql`, `)}) and ${products.active} = 1 and ${products.hidden} = 0 and ${products.stock} <> -250 and coalesce(${products.blockedReason}, '') = ''`)
      : Promise.resolve([] as { sku: string; slug: string }[]),
  ]);

  const byLegacy = new Map<string, { slug: string; name: string }>();
  const bySlug = new Map<string, { slug: string; name: string }>();
  for (const r of catBatches.flat()) {
    if (r.legacySlug) byLegacy.set(r.legacySlug.toLowerCase(), r);
    bySlug.set(r.slug, r);
  }
  const bySku = new Map(skuRows.map((r) => [r.sku.toUpperCase(), r.slug]));

  const cat = (ref: CatRef): NavLink | null => {
    const row = byLegacy.get(legacyKey(ref.cat)) ?? bySlug.get(slugKey(ref.cat));
    if (!row) return null;
    return { label: ref.label ?? row.name, href: `/c/${row.slug}`, logo: ref.logo };
  };
  const link = (ref: Ref): NavLink | null => {
    if ('cat' in ref) return cat(ref);
    if ('sku' in ref) {
      const slug = bySku.get(ref.sku.toUpperCase());
      return slug ? { label: ref.label, href: `/p/${slug}` } : null;
    }
    return { label: ref.size, href: `/air-filters/size/${ref.size}` };
  };
  const links = (items: Ref[]) => items.map(link).filter((l): l is NavLink => l !== null);

  const items: NavFlyout[] = [];
  for (const s of specs) {
    const top = cat({ cat: s.cat, label: s.label });
    if (!top) continue;
    items.push({
      key: s.key,
      label: s.label,
      href: top.href,
      image: s.image,
      columns: s.columns.map((c) => ({ title: c.title, layout: c.layout, links: links(c.items), viewAll: c.viewAll ? (cat(c.viewAll) ?? undefined) : undefined })).filter((c) => c.links.length > 0),
    });
  }
  const tabs: MoreTab[] = MORE_TABS.map((t) => ({
    key: t.key,
    label: t.label,
    promo: t.promo,
    groups: t.groups.map((g) => ({ title: g.title, links: links(g.items) })).filter((g) => g.links.length > 0),
  })).filter((t) => t.groups.length > 0);

  return { items, more: { label: 'More Products', tabs, sale: cat(SALE) ?? { label: 'Sale', href: '/c/overstock-items' } } };
}
