import { eq } from 'drizzle-orm';
import { siteSettings } from '@ff/db';
import { getDb } from './db';

/**
 * Typed access to `site_settings` (JSON values keyed by name) for the storefront, with a short
 * per-isolate cache so pages don't hit D1 for every flag. The manager writes the same rows.
 */

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: unknown }>();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return (hit.value as T) ?? fallback;
  const row = await getDb().query.siteSettings.findFirst({ where: eq(siteSettings.key, key) });
  let value: unknown = undefined;
  if (row) {
    try {
      value = JSON.parse(row.value);
    } catch {
      value = row.value;
    }
  }
  cache.set(key, { at: Date.now(), value });
  return (value as T) ?? fallback;
}

export function forgetSetting(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}

/** Storefront feature flags (legacy `mods` row + Inbound Manager switches). */
export interface FeatureFlags {
  dynamicTitles: boolean;
  showRelated: boolean;
  showWhyNotTry: boolean;
  whyNotTryWording: string;
  showDiscountPricing: boolean;
  showShippingOnPdp: boolean;
  phoneEnabled: boolean;
  phoneHighVolume: boolean;
  chatEnabled: boolean;
  textChatEnabled: boolean;
  /** 0 normal, 1 long wait, 2 phones down */
  callWaitState: 0 | 1 | 2;
  weatherAlert: string;
  techDifficultiesAlert: string;
}

export const DEFAULT_FEATURES: FeatureFlags = {
  dynamicTitles: true,
  showRelated: true,
  showWhyNotTry: true,
  whyNotTryWording: 'Why not try',
  showDiscountPricing: true,
  showShippingOnPdp: false,
  phoneEnabled: true,
  phoneHighVolume: false,
  chatEnabled: true,
  textChatEnabled: true,
  callWaitState: 0,
  weatherAlert: '',
  techDifficultiesAlert: '',
};

export async function getFeatures(): Promise<FeatureFlags> {
  const stored = await getSetting<Partial<FeatureFlags>>('features', {});
  return { ...DEFAULT_FEATURES, ...stored };
}

/** The file to show for a named site graphic right now: the scheduled swap when it applies, else the default (legacy CP graphics). */
export async function resolveGraphic(location: string, fallback: string | null = null): Promise<string | null> {
  const rows = await getSetting<{ location: string; defaultUrl: string; specialUrl: string; startsAt: string | null; endsAt: string | null; force: boolean }[]>('graphics', []);
  const g = rows.find((r) => r.location === location);
  if (!g) return fallback;
  const today = new Date().toISOString().slice(0, 10);
  const scheduled = g.specialUrl && (g.force || ((!g.startsAt || g.startsAt <= today) && (!g.endsAt || g.endsAt >= today)));
  return (scheduled ? g.specialUrl : g.defaultUrl) || fallback;
}
