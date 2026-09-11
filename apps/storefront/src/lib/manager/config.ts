import { and, asc, eq, sql } from 'drizzle-orm';
import { locations, shipMethods, shipRates, siteSettings } from '@ff/db';
import { getDb } from '../db';
import { DEFAULT_FEATURES, forgetSetting, type FeatureFlags } from '../settings';

/**
 * Configuration side of the manager: feature flags, shipping methods and rates, locations and
 * tax, marketplace tax facilitators, carrier settings, text/email templates
 * (legacy SA_mods, SA_inboundmgmt, SA_ship*, SA_loc*, SA_marketplace_taxes, utilities_Config,
 * utilities_Text). All of it lives in `site_settings` JSON or the shipping/location tables.
 */

export class ConfigError extends Error {}

// ---------- generic JSON settings ----------

export async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await getDb().query.siteSettings.findFirst({ where: eq(siteSettings.key, key) });
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function writeSetting(key: string, value: unknown, description?: string): Promise<void> {
  const json = JSON.stringify(value);
  await getDb()
    .insert(siteSettings)
    .values({ key, value: json, description: description ?? null, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: json, updatedAt: new Date().toISOString(), ...(description ? { description } : {}) } });
  forgetSetting(key);
}

// ---------- feature flags ----------

export async function getFeatureFlags(): Promise<FeatureFlags> {
  return { ...DEFAULT_FEATURES, ...(await readSetting<Partial<FeatureFlags>>('features', {})) };
}

export async function saveFeatureFlags(flags: FeatureFlags): Promise<void> {
  await writeSetting('features', flags, 'Storefront feature flags and contact-channel switches (legacy mods + Inbound Manager)');
}

// ---------- store / contact / text templates ----------

export interface StoreSettings {
  companyName: string;
  companyAddress: string;
  salesEmail: string;
  adminEmail: string;
  supportPhone: string;
  supportHours: string;
  orderPrefix: string;
  maxCartQty: number;
  minCartCents: number;
  lowStockThreshold: number;
  /** legacy pHideAddStockLevel: show "low stock" at or below */
  lowStockWarnAt: number;
  handlingFeeCents: number;
  taxOnShipping: boolean;
  allowShipToDifferent: boolean;
  catalogOnly: boolean;
}

export const DEFAULT_STORE: StoreSettings = {
  companyName: 'Filters Fast, LLC',
  companyAddress: '',
  salesEmail: 'sales@filtersfast.com',
  adminEmail: 'webdevteam@filtersfast.com',
  supportPhone: '(866) 438-3458',
  supportHours: 'Mon–Fri 8am–8pm ET',
  orderPrefix: 'FF',
  maxCartQty: 99,
  minCartCents: 0,
  lowStockThreshold: 5,
  lowStockWarnAt: 5,
  handlingFeeCents: 0,
  taxOnShipping: false,
  allowShipToDifferent: true,
  catalogOnly: false,
};

export async function getStoreSettings(): Promise<StoreSettings> {
  return { ...DEFAULT_STORE, ...(await readSetting<Partial<StoreSettings>>('store', {})) };
}

export async function saveStoreSettings(s: StoreSettings): Promise<void> {
  if (!s.companyName.trim()) throw new ConfigError('Company name is required.');
  for (const [k, v] of Object.entries({ salesEmail: s.salesEmail, adminEmail: s.adminEmail })) if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new ConfigError(`${k} must be a valid email address.`);
  await writeSetting('store', s, 'Store identity, contact and cart limits (legacy storeAdmin config)');
}

/** Legacy utilities_Text: editable copy blocks with #TAGS#. */
export const TEXT_TEMPLATES: { key: string; label: string; tags: string; html: boolean }[] = [
  { key: 'cartMessage', label: 'Cart page message', tags: 'HTML allowed; shown above the cart', html: true },
  { key: 'checkoutMessage', label: 'Checkout message', tags: 'HTML allowed; shown on the payment step', html: true },
  { key: 'orderStatusEmail', label: 'Order status update email body', tags: '#NAME# #STAT# #ORDER# #DATE# #TOTAL# #STORE#', html: true },
  { key: 'orderCancelledEmail', label: 'Order cancelled email body', tags: '#NAME# #ORDER# #DATE# #TOTAL# #STORE#', html: true },
  { key: 'orderCompleteEmail', label: 'Delivery confirmation email body', tags: '#NAME# #ORDER# #CARRIER# #TRACKING# #TRACKINGLINK# #STORE#', html: true },
  { key: 'backInStockEmail', label: 'Back-in-stock email body', tags: '#PRODUCT# #SKU# #LINK# #STORE#', html: true },
  { key: 'paySuccessMessage', label: 'Payment success message', tags: '#STORE# #SALES#', html: true },
  { key: 'payErrorMessage', label: 'Payment error message', tags: '#STORE# #SALES#', html: true },
  { key: 'emailToFriend', label: 'Email-a-friend text', tags: '#PROD# #LINK# #PRICE# #STORE#', html: false },
];

export async function getTextTemplates(): Promise<Record<string, string>> {
  return readSetting<Record<string, string>>('textTemplates', {});
}

export async function saveTextTemplates(values: Record<string, string>): Promise<void> {
  const cur = await getTextTemplates();
  for (const t of TEXT_TEMPLATES) if (values[t.key] !== undefined) cur[t.key] = values[t.key]!;
  await writeSetting('textTemplates', cur, 'Editable copy blocks and email bodies (legacy utilities_Text)');
}

// ---------- carrier settings ----------

export interface CarrierSettings {
  ups: { active: boolean; accountNumber: string; fromCountry: string; fromZip: string; services: string[]; pickupType: string; packageType: string; weightUnit: 'LBS' | 'KGS' };
  usps: { active: boolean; fromZip: string; services: string[]; international: boolean; size: 'REGULAR' | 'LARGE'; machinable: boolean };
  fedex: { active: boolean; accountNumber: string; fromZip: string; services: string[] };
  canadaPost: { active: boolean; customerNumber: string; fromPostal: string; boxL: number; boxW: number; boxH: number };
  /** free shipping threshold shown to customers (the provider reads FREE_SHIPPING_THRESHOLD too) */
  freeShippingThresholdCents: number;
  freeShippingThresholdVipCents: number;
}

export const DEFAULT_CARRIERS: CarrierSettings = {
  ups: { active: false, accountNumber: '', fromCountry: 'US', fromZip: '28110', services: ['03'], pickupType: '01', packageType: '02', weightUnit: 'LBS' },
  usps: { active: false, fromZip: '28110', services: ['Priority'], international: false, size: 'REGULAR', machinable: true },
  fedex: { active: false, accountNumber: '', fromZip: '28110', services: ['FEDEX_GROUND'] },
  canadaPost: { active: false, customerNumber: '', fromPostal: '', boxL: 30, boxW: 30, boxH: 30 },
  freeShippingThresholdCents: 9900,
  freeShippingThresholdVipCents: 7500,
};

export const UPS_SERVICES: [string, string][] = [['01', 'Next Day Air'], ['02', '2nd Day Air'], ['03', 'Ground'], ['07', 'Worldwide Express'], ['08', 'Worldwide Expedited'], ['11', 'Standard'], ['12', '3 Day Select'], ['13', 'Next Day Air Saver'], ['14', 'Next Day Air Early'], ['54', 'Worldwide Express Plus'], ['59', '2nd Day Air A.M.'], ['65', 'Express Saver']];
export const UPS_PICKUPS: [string, string][] = [['01', 'Daily pickup'], ['03', 'Customer counter'], ['06', 'One-time pickup'], ['07', 'On-call air'], ['19', 'Letter center'], ['20', 'Air service center']];
export const UPS_PACKAGES: [string, string][] = [['02', 'Package'], ['00', 'Unknown'], ['01', 'Letter'], ['03', 'Tube'], ['04', 'Pak'], ['21', 'Express box'], ['24', '25 kg box'], ['25', '10 kg box']];
export const USPS_SERVICES = ['Express', 'First Class', 'Priority', 'Parcel'];
export const FEDEX_SERVICES: [string, string][] = [['FEDEX_GROUND', 'Ground'], ['GROUND_HOME_DELIVERY', 'Home Delivery'], ['FEDEX_2_DAY', '2Day'], ['STANDARD_OVERNIGHT', 'Standard Overnight'], ['PRIORITY_OVERNIGHT', 'Priority Overnight']];

export async function getCarrierSettings(): Promise<CarrierSettings> {
  const s = await readSetting<Partial<CarrierSettings>>('carriers', {});
  return { ...DEFAULT_CARRIERS, ...s, ups: { ...DEFAULT_CARRIERS.ups, ...(s.ups ?? {}) }, usps: { ...DEFAULT_CARRIERS.usps, ...(s.usps ?? {}) }, fedex: { ...DEFAULT_CARRIERS.fedex, ...(s.fedex ?? {}) }, canadaPost: { ...DEFAULT_CARRIERS.canadaPost, ...(s.canadaPost ?? {}) } };
}

export async function saveCarrierSettings(s: CarrierSettings): Promise<void> {
  if (s.ups.active && !/^[A-Z]{2}$/.test(s.ups.fromCountry)) throw new ConfigError('UPS origin country must be a 2-letter code.');
  if (s.ups.active && !s.ups.fromZip.trim()) throw new ConfigError('UPS origin ZIP is required.');
  if (s.usps.active && !s.usps.services.length) throw new ConfigError('Choose at least one USPS service.');
  if (s.canadaPost.active && !/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(s.canadaPost.fromPostal)) throw new ConfigError('Canada Post origin must be a Canadian postal code.');
  await writeSetting('carriers', s, 'Carrier rate settings (legacy SA_shipUPS / USPS / CP). API keys are Wrangler secrets, never stored here.');
}

// ---------- shipping methods and rates ----------

export async function listShipMethods() {
  return getDb()
    .select({ id: shipMethods.id, name: shipMethods.name, active: shipMethods.active, rateCount: sql<number>`(select count(*) from ship_rates r where r.method_id = ${shipMethods.id})` })
    .from(shipMethods)
    .orderBy(asc(shipMethods.name));
}

export async function saveShipMethod(id: number | null, input: { name: string; active: boolean }): Promise<number> {
  const db = getDb();
  const name = input.name.trim();
  if (!name) throw new ConfigError('Method name is required.');
  const dup = await db.select({ id: shipMethods.id }).from(shipMethods).where(sql`lower(${shipMethods.name}) = lower(${name})`).limit(1);
  if (dup[0] && dup[0].id !== id) throw new ConfigError(`"${name}" already exists.`);
  if (id) {
    await db.update(shipMethods).set({ name, active: input.active }).where(eq(shipMethods.id, id));
    return id;
  }
  const [max] = await db.select({ m: sql<number>`coalesce(max(id), 0)` }).from(shipMethods);
  const newId = (max?.m ?? 0) + 1;
  await db.insert(shipMethods).values({ id: newId, name, active: input.active });
  return newId;
}

/** Deleting a method removes its rates (legacy cascade). */
export async function deleteShipMethod(id: number): Promise<void> {
  const db = getDb();
  await db.delete(shipRates).where(eq(shipRates.methodId, id));
  await db.delete(shipMethods).where(eq(shipMethods.id, id));
}

export async function listShipRates(filter: { methodId?: number | null; zone?: number | null; unitType?: string | null }) {
  return getDb()
    .select({ id: shipRates.id, methodId: shipRates.methodId, methodName: shipMethods.name, zone: shipRates.zone, unitType: shipRates.unitType, unitsFrom: shipRates.unitsFrom, unitsTo: shipRates.unitsTo, addAmountCents: shipRates.addAmountCents, addPercent: shipRates.addPercent })
    .from(shipRates)
    .innerJoin(shipMethods, eq(shipMethods.id, shipRates.methodId))
    .where(and(filter.methodId ? eq(shipRates.methodId, filter.methodId) : undefined, filter.zone !== null && filter.zone !== undefined ? eq(shipRates.zone, filter.zone) : undefined, filter.unitType ? eq(shipRates.unitType, filter.unitType) : undefined))
    .orderBy(asc(shipMethods.name), asc(shipRates.zone), asc(shipRates.unitType), asc(shipRates.unitsFrom))
    .limit(2000);
}

export async function saveShipRate(id: number | null, input: { methodId: number; zone: number; unitType: string; unitsFrom: number; unitsTo: number; addAmountCents: number; addPercent: number }): Promise<number> {
  const db = getDb();
  const m = await db.query.shipMethods.findFirst({ where: eq(shipMethods.id, input.methodId) });
  if (!m) throw new ConfigError('Shipping method not found.');
  if (!Number.isInteger(input.zone) || input.zone < 0) throw new ConfigError('Zone must be a whole number.');
  const unitType = input.unitType === 'W' ? 'W' : 'P';
  if (!(input.unitsTo > input.unitsFrom)) throw new ConfigError('"Units to" must be greater than "units from".');
  if (input.addAmountCents <= 0 && input.addPercent <= 0) throw new ConfigError('Enter an amount and/or a percentage.');
  const row = { methodId: input.methodId, zone: input.zone, unitType, unitsFrom: input.unitsFrom, unitsTo: input.unitsTo, addAmountCents: input.addAmountCents, addPercent: input.addPercent };
  if (id) {
    await db.update(shipRates).set(row).where(eq(shipRates.id, id));
    return id;
  }
  const [max] = await db.select({ m: sql<number>`coalesce(max(id), 0)` }).from(shipRates);
  const newId = (max?.m ?? 0) + 1;
  await db.insert(shipRates).values({ ...row, id: newId });
  return newId;
}

export async function deleteShipRate(id: number): Promise<void> {
  await getDb().delete(shipRates).where(eq(shipRates.id, id));
}

// ---------- locations and tax ----------

export async function listCountries(filter: { start?: string; tax?: 'yes' | 'no' | ''; zone?: number | null } = {}) {
  const db = getDb();
  const rows = await db
    .select({ id: locations.id, name: locations.name, country: locations.country, taxRate: locations.taxRate, shipZone: locations.shipZone, active: locations.active, states: sql<number>`(select count(*) from locations s where s.country = ${locations.country} and s.region is not null and s.region <> '')` })
    .from(locations)
    .where(and(sql`(${locations.region} is null or ${locations.region} = '')`, filter.start ? sql`upper(substr(${locations.name}, 1, 1)) = ${filter.start.toUpperCase()}` : undefined, filter.tax === 'yes' ? sql`${locations.taxRate} > 0` : filter.tax === 'no' ? eq(locations.taxRate, 0) : undefined, filter.zone !== null && filter.zone !== undefined ? eq(locations.shipZone, filter.zone) : undefined))
    .orderBy(asc(locations.name));
  return rows;
}

export async function getCountryAdmin(country: string) {
  const db = getDb();
  const c = country.toUpperCase();
  const row = await db.query.locations.findFirst({ where: and(eq(locations.country, c), sql`(${locations.region} is null or ${locations.region} = '')`) });
  if (!row) return null;
  const states = await db
    .select()
    .from(locations)
    .where(and(eq(locations.country, c), sql`${locations.region} is not null and ${locations.region} <> ''`))
    .orderBy(asc(locations.name));
  return { country: row, states };
}

export async function saveCountry(id: number | null, input: { country: string; name: string; taxRate: number; shipZone: number | null; active: boolean }): Promise<number> {
  const db = getDb();
  const code = input.country.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new ConfigError('Country code must be 2 letters.');
  if (!input.name.trim()) throw new ConfigError('Country name is required.');
  const dup = await db.query.locations.findFirst({ where: and(eq(locations.country, code), sql`(${locations.region} is null or ${locations.region} = '')`) });
  if (dup && dup.id !== id) throw new ConfigError(`Country ${code} already exists.`);
  const row = { country: code, region: null, name: input.name.trim(), taxRate: input.taxRate, shipZone: input.shipZone, active: input.active };
  if (id) {
    const old = await db.query.locations.findFirst({ where: eq(locations.id, id) });
    await db.update(locations).set(row).where(eq(locations.id, id));
    if (old && old.country !== code) await db.update(locations).set({ country: code }).where(eq(locations.country, old.country)); // cascade the code to its states
    return id;
  }
  const [max] = await db.select({ m: sql<number>`coalesce(max(id), 0)` }).from(locations);
  const newId = (max?.m ?? 0) + 1;
  await db.insert(locations).values({ ...row, id: newId });
  return newId;
}

export async function saveState(id: number | null, input: { country: string; region: string; name: string; taxRate: number; shipZone: number | null; active: boolean }): Promise<number> {
  const db = getDb();
  const country = input.country.trim().toUpperCase();
  const region = input.region.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,3}$/.test(region)) throw new ConfigError('State/province code must be 1–3 letters or digits.');
  if (!input.name.trim()) throw new ConfigError('State name is required.');
  const parent = await db.query.locations.findFirst({ where: and(eq(locations.country, country), sql`(${locations.region} is null or ${locations.region} = '')`) });
  if (!parent) throw new ConfigError(`Country ${country} does not exist.`);
  const dup = await db.query.locations.findFirst({ where: and(eq(locations.country, country), eq(locations.region, region)) });
  if (dup && dup.id !== id) throw new ConfigError(`${country}/${region} already exists.`);
  const row = { country, region, name: input.name.trim(), taxRate: input.taxRate, shipZone: input.shipZone, active: input.active };
  if (id) {
    await db.update(locations).set(row).where(eq(locations.id, id));
    return id;
  }
  const [max] = await db.select({ m: sql<number>`coalesce(max(id), 0)` }).from(locations);
  const newId = (max?.m ?? 0) + 1;
  await db.insert(locations).values({ ...row, id: newId });
  return newId;
}

/** Deleting a country removes its states too (legacy cascade). */
export async function deleteLocation(id: number): Promise<void> {
  const db = getDb();
  const row = await db.query.locations.findFirst({ where: eq(locations.id, id) });
  if (!row) return;
  if (!row.region) await db.delete(locations).where(eq(locations.country, row.country));
  else await db.delete(locations).where(eq(locations.id, id));
}

export async function listShipZones(): Promise<number[]> {
  const rows = await getDb().select({ z: locations.shipZone }).from(locations).where(sql`${locations.shipZone} is not null`).groupBy(locations.shipZone).orderBy(asc(locations.shipZone));
  return rows.map((r) => r.z!).filter((z) => z !== null);
}

// ---------- marketplace tax facilitators ----------

export const MARKETPLACES = ['amazon', 'ebay', 'walmart', 'sears'] as const;

export async function getFacilitatorStates(): Promise<Record<string, string[]>> {
  const raw = await readSetting<Record<string, string[]> | string[]>('tax.marketplaceFacilitatorStates', {});
  // the import stored a flat list when all marketplaces shared it
  if (Array.isArray(raw)) return Object.fromEntries(MARKETPLACES.map((m) => [m, [...raw]]));
  return raw;
}

export async function saveFacilitatorStates(map: Record<string, string[]>): Promise<void> {
  const clean: Record<string, string[]> = {};
  for (const m of MARKETPLACES) clean[m] = [...new Set((map[m] ?? []).map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z]{2,3}$/.test(s)))].sort();
  await writeSetting('tax.marketplaceFacilitatorStates', clean, 'States where each marketplace collects sales tax on our behalf (legacy marketplace_state_tax_facilitators)');
}

// ---------- site content: scheduled graphics, donation text, fundraiser ----------

/** A named site graphic that can be swapped for another file between two dates (legacy edit_graphics / CP graphics). */
export interface SiteGraphic {
  /** code name, no spaces (e.g. home-hero, header-promo) */
  location: string;
  defaultUrl: string;
  specialUrl: string;
  /** YYYY-MM-DD, inclusive */
  startsAt: string | null;
  endsAt: string | null;
  /** show the special file regardless of the dates */
  force: boolean;
}

export async function getSiteGraphics(): Promise<SiteGraphic[]> {
  return readSetting<SiteGraphic[]>('graphics', []);
}

export async function saveSiteGraphics(rows: SiteGraphic[]): Promise<void> {
  const seen = new Set<string>();
  const clean: SiteGraphic[] = [];
  for (const r of rows) {
    const location = r.location.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!location) continue;
    if (seen.has(location)) throw new ConfigError(`Location "${location}" is listed twice.`);
    seen.add(location);
    const date = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    const startsAt = date(r.startsAt);
    const endsAt = date(r.endsAt);
    if (startsAt && endsAt && endsAt < startsAt) throw new ConfigError(`"${location}": the stop date is before the start date.`);
    clean.push({ location, defaultUrl: r.defaultUrl.trim(), specialUrl: r.specialUrl.trim(), startsAt, endsAt, force: r.force });
  }
  await writeSetting('graphics', clean, 'Scheduled graphic swaps by location (legacy CP graphics)');
}

/** Checkout donation copy (legacy Edit_donate_text + the Wine To Water fund). */
export interface DonationSettings {
  enabled: boolean;
  charityName: string;
  blurb: string;
  /** raw HTML shown in the "learn more" panel (legacy w3_more.html) */
  moreHtml: string;
}

export const DEFAULT_DONATION: DonationSettings = { enabled: true, charityName: 'Wine To Water', blurb: 'bringing clean water to communities in need.', moreHtml: '' };

export async function getDonationSettings(): Promise<DonationSettings> {
  return { ...DEFAULT_DONATION, ...(await readSetting<Partial<DonationSettings>>('donation', {})) };
}

export async function saveDonationSettings(s: DonationSettings): Promise<void> {
  if (!s.charityName.trim()) throw new ConfigError('The charity name is required.');
  await writeSetting('donation', { ...s, charityName: s.charityName.trim(), blurb: s.blurb.trim() }, 'Checkout donation copy (legacy Edit_donate_text)');
}

/** The fundraiser record (legacy Edit_fund): one campaign at a time. */
export interface Fundraiser {
  campaignId: string;
  startDate: string | null;
  endDate: string | null;
  requestedStart: string | null;
  orgName: string;
  orgAddress: string;
  orgCity: string;
  orgState: string;
  orgZip: string;
  federalId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  active: boolean;
  approved: boolean;
}

export const EMPTY_FUNDRAISER: Fundraiser = { campaignId: '', startDate: null, endDate: null, requestedStart: null, orgName: '', orgAddress: '', orgCity: '', orgState: '', orgZip: '', federalId: '', contactName: '', contactEmail: '', contactPhone: '', active: false, approved: false };

export async function getFundraiser(): Promise<Fundraiser> {
  return { ...EMPTY_FUNDRAISER, ...(await readSetting<Partial<Fundraiser>>('fundraiser', {})) };
}

export async function saveFundraiser(f: Fundraiser): Promise<void> {
  if (f.active && !f.orgName.trim()) throw new ConfigError('An active fundraiser needs an organisation name.');
  if (f.startDate && f.endDate && f.endDate < f.startDate) throw new ConfigError('The end date is before the start date.');
  await writeSetting('fundraiser', f, 'Fundraiser campaign record (legacy Edit_fund)');
}
