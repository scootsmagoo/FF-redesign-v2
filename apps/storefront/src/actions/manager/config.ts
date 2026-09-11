import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { requireArea } from '~/lib/manager/permissions';
import { ConfigError, DEFAULT_CARRIERS, deleteLocation, deleteShipMethod, deleteShipRate, getCarrierSettings, MARKETPLACES, saveCarrierSettings, saveCountry, saveFacilitatorStates, saveFeatureFlags, saveShipMethod, saveShipRate, saveState, saveStoreSettings, saveTextTemplates, TEXT_TEMPLATES } from '~/lib/manager/config';
import { dollarsToCents, toBool, toInt, toNum } from '~/lib/manager/util';
import type { FeatureFlags } from '~/lib/settings';

const fail = (e: unknown): never => {
  throw new ActionError({ code: 'BAD_REQUEST', message: e instanceof ConfigError || e instanceof Error ? e.message : 'Something went wrong' });
};
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);

export const configActions = {
  saveFeatureFlags: defineAction({
    accept: 'form',
    input: z.object({}).catchall(z.any()),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Mods', 1);
      const f = input as Record<string, unknown>;
      const flags: FeatureFlags = {
        dynamicTitles: toBool(f.dynamicTitles),
        showRelated: toBool(f.showRelated),
        showWhyNotTry: toBool(f.showWhyNotTry),
        whyNotTryWording: String(f.whyNotTryWording ?? 'Why not try').slice(0, 50),
        showDiscountPricing: toBool(f.showDiscountPricing),
        showShippingOnPdp: toBool(f.showShippingOnPdp),
        phoneEnabled: toBool(f.phoneEnabled),
        phoneHighVolume: toBool(f.phoneHighVolume),
        chatEnabled: toBool(f.chatEnabled),
        textChatEnabled: toBool(f.textChatEnabled),
        callWaitState: ([0, 1, 2].includes(Number(f.callWaitState)) ? Number(f.callWaitState) : 0) as 0 | 1 | 2,
        weatherAlert: String(f.weatherAlert ?? '').slice(0, 500),
        techDifficultiesAlert: String(f.techDifficultiesAlert ?? '').slice(0, 500),
      };
      // the alert banners and phone switches are the legacy Inbound Manager: needs that area too
      if ((flags.weatherAlert || flags.techDifficultiesAlert || flags.callWaitState !== 0) && !ctx.locals.admin?.siteAdmin) requireArea(ctx, 'InboundManager', 1);
      await saveFeatureFlags(flags);
      return { ok: true };
    },
  }),

  saveStoreSettings: defineAction({
    accept: 'form',
    input: z.object({}).catchall(z.any()),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Setup', 1);
      const f = input as Record<string, unknown>;
      const s = (k: string, d = '') => String(f[k] ?? d);
      try {
        await saveStoreSettings({
          companyName: s('companyName'),
          companyAddress: s('companyAddress'),
          salesEmail: s('salesEmail').toLowerCase(),
          adminEmail: s('adminEmail').toLowerCase(),
          supportPhone: s('supportPhone'),
          supportHours: s('supportHours'),
          orderPrefix: s('orderPrefix', 'FF').toUpperCase().slice(0, 4),
          maxCartQty: toInt(f.maxCartQty, 99) ?? 99,
          minCartCents: dollarsToCents(s('minCart')) ?? 0,
          lowStockThreshold: toInt(f.lowStockThreshold, 5) ?? 5,
          lowStockWarnAt: toInt(f.lowStockWarnAt, 5) ?? 5,
          handlingFeeCents: dollarsToCents(s('handlingFee')) ?? 0,
          taxOnShipping: toBool(f.taxOnShipping),
          allowShipToDifferent: toBool(f.allowShipToDifferent),
          catalogOnly: toBool(f.catalogOnly),
        });
      } catch (e) {
        return fail(e);
      }
      return { ok: true };
    },
  }),

  saveTextTemplates: defineAction({
    accept: 'form',
    input: z.object({}).catchall(z.any()),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Setup', 1);
      const f = input as Record<string, unknown>;
      const values: Record<string, string> = {};
      for (const t of TEXT_TEMPLATES) if (f[t.key] !== undefined && f[t.key] !== null) values[t.key] = String(f[t.key]);
      await saveTextTemplates(values);
      return { ok: true };
    },
  }),

  saveCarrierSettings: defineAction({
    accept: 'form',
    // Repeated checkbox names must be declared as arrays: a catch-all keeps only the last value.
    input: z.object({ 'ups.services': z.array(z.string()).default([]), 'usps.services': z.array(z.string()).default([]), 'fedex.services': z.array(z.string()).default([]) }).catchall(z.any()),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Shipping', 1);
      const f = input as Record<string, unknown>;
      const cur = await getCarrierSettings();
      const s = (k: string, d = '') => String(f[k] ?? d).trim();
      try {
        await saveCarrierSettings({
          ups: { active: toBool(f['ups.active']), accountNumber: s('ups.accountNumber'), fromCountry: s('ups.fromCountry', 'US').toUpperCase(), fromZip: s('ups.fromZip'), services: list(input['ups.services']), pickupType: s('ups.pickupType', '01'), packageType: s('ups.packageType', '02'), weightUnit: s('ups.weightUnit') === 'KGS' ? 'KGS' : 'LBS' },
          usps: { active: toBool(f['usps.active']), fromZip: s('usps.fromZip'), services: list(input['usps.services']), international: toBool(f['usps.international']), size: s('usps.size') === 'LARGE' ? 'LARGE' : 'REGULAR', machinable: toBool(f['usps.machinable']) },
          fedex: { active: toBool(f['fedex.active']), accountNumber: s('fedex.accountNumber'), fromZip: s('fedex.fromZip'), services: list(input['fedex.services']) },
          canadaPost: { active: toBool(f['cp.active']), customerNumber: s('cp.customerNumber'), fromPostal: s('cp.fromPostal').toUpperCase(), boxL: toNum(f['cp.boxL'], 30) ?? 30, boxW: toNum(f['cp.boxW'], 30) ?? 30, boxH: toNum(f['cp.boxH'], 30) ?? 30 },
          freeShippingThresholdCents: dollarsToCents(s('freeShippingThreshold')) ?? cur.freeShippingThresholdCents ?? DEFAULT_CARRIERS.freeShippingThresholdCents,
          freeShippingThresholdVipCents: dollarsToCents(s('freeShippingThresholdVip')) ?? cur.freeShippingThresholdVipCents ?? DEFAULT_CARRIERS.freeShippingThresholdVipCents,
        });
      } catch (e) {
        return fail(e);
      }
      return { ok: true };
    },
  }),

  saveShipMethod: defineAction({
    accept: 'form',
    input: z.object({ methodId: z.number().int().nonnegative().default(0), name: z.string().max(100), active: z.boolean().default(true) }),
    handler: async ({ methodId, name, active }, ctx) => {
      requireArea(ctx, 'Shipping', 1);
      try {
        return { ok: true, id: await saveShipMethod(methodId || null, { name, active }) };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  deleteShipMethod: defineAction({
    accept: 'form',
    input: z.object({ methodId: z.number().int().positive() }),
    handler: async ({ methodId }, ctx) => {
      requireArea(ctx, 'Shipping', 1);
      await deleteShipMethod(methodId);
      return { ok: true };
    },
  }),
  saveShipRate: defineAction({
    accept: 'form',
    input: z.object({ rateId: z.number().int().nonnegative().default(0), methodId: z.number().int().positive(), zone: z.number().int(), unitType: z.string().max(1), unitsFrom: z.number(), unitsTo: z.number(), addAmount: z.string().max(12).nullish(), addPercent: z.string().max(12).nullish() }),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Shipping', 1);
      try {
        return { ok: true, id: await saveShipRate(input.rateId || null, { methodId: input.methodId, zone: input.zone, unitType: input.unitType, unitsFrom: input.unitsFrom, unitsTo: input.unitsTo, addAmountCents: dollarsToCents(input.addAmount) ?? 0, addPercent: toNum(input.addPercent, 0) ?? 0 }) };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  deleteShipRate: defineAction({
    accept: 'form',
    input: z.object({ rateId: z.number().int().positive() }),
    handler: async ({ rateId }, ctx) => {
      requireArea(ctx, 'Shipping', 1);
      await deleteShipRate(rateId);
      return { ok: true };
    },
  }),

  saveCountry: defineAction({
    accept: 'form',
    input: z.object({ locationId: z.number().int().nonnegative().default(0), country: z.string().max(2), name: z.string().max(100), taxRate: z.string().max(10).nullish(), shipZone: z.string().max(4).nullish(), active: z.boolean().default(true) }),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Locations', 1);
      try {
        return { ok: true, id: await saveCountry(input.locationId || null, { country: input.country, name: input.name, taxRate: toNum(input.taxRate, 0) ?? 0, shipZone: toInt(input.shipZone), active: input.active }), country: input.country.toUpperCase() };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  saveState: defineAction({
    accept: 'form',
    input: z.object({ locationId: z.number().int().nonnegative().default(0), country: z.string().max(2), region: z.string().max(3), name: z.string().max(100), taxRate: z.string().max(10).nullish(), shipZone: z.string().max(4).nullish(), active: z.boolean().default(true) }),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Locations', 1);
      try {
        return { ok: true, id: await saveState(input.locationId || null, { country: input.country, region: input.region, name: input.name, taxRate: toNum(input.taxRate, 0) ?? 0, shipZone: toInt(input.shipZone), active: input.active }), country: input.country.toUpperCase() };
      } catch (e) {
        return fail(e);
      }
    },
  }),
  deleteLocation: defineAction({
    accept: 'form',
    input: z.object({ locationId: z.number().int().positive(), country: z.string().max(2).nullish() }),
    handler: async ({ locationId, country }, ctx) => {
      requireArea(ctx, 'Locations', 1);
      await deleteLocation(locationId);
      return { ok: true, country: country?.toUpperCase() ?? null };
    },
  }),

  saveFacilitators: defineAction({
    accept: 'form',
    input: z.object({}).catchall(z.any()),
    handler: async (input, ctx) => {
      requireArea(ctx, 'Locations', 1);
      const f = input as Record<string, unknown>;
      const map: Record<string, string[]> = {};
      for (const m of MARKETPLACES) map[m] = String(f[m] ?? '').split(/[^A-Za-z]+/).filter(Boolean);
      await saveFacilitatorStates(map);
      return { ok: true };
    },
  }),
};
