import { ActionError } from 'astro:actions';

/**
 * Manager permissions, modelled on the legacy cp_permissions / GetAccessLevel():
 * every area has a level  -1 none · 0 read-only · 1 full control · 2 restricted control.
 * Levels live as JSON maps on `admin_roles.permissions` and, per admin, `admins.permissions`
 * (overrides). An admin with no role and no overrides is a Site Administrator.
 */

export type Level = -1 | 0 | 1 | 2;
export type PermissionMap = Record<string, Level>;

export const SITE_ADMIN_ROLE = 'Site Administrator';

export interface AreaDef {
  name: string;
  group: string;
  description: string;
  /** read-only (0) is not offered, as in the legacy editor */
  noReadOnly?: boolean;
  /** restricted control (2) is meaningful for this area */
  allowsRestricted?: boolean;
  /** only a Site Administrator may grant full control */
  siteAdminGrantsFull?: boolean;
}

/** Legacy permission names, grouped as the legacy role editor grouped them. Order = display order. */
export const AREAS: AreaDef[] = [
  { name: 'Setup', group: 'Site Administration', description: 'Site settings, feature flags, email templates, utilities', allowsRestricted: true },
  { name: 'Mods', group: 'Site Administration', description: 'Storefront feature flags (mods)' },
  { name: 'Statistics', group: 'Site Administration', description: 'Reports and dashboards' },
  { name: 'Admins', group: 'Site Administration', description: 'Staff accounts and roles' },
  { name: 'Vault', group: 'Site Administration', description: 'Secrets and integration status' },
  { name: 'Orders', group: 'Order Management', description: 'Orders: view, edit, status, notes', allowsRestricted: true },
  { name: 'Returns', group: 'Order Management', description: 'Returns and refund queue' },
  { name: 'Credits', group: 'Order Management', description: 'Order credits ledger' },
  { name: 'CreditAPI', group: 'Order Management', description: 'Issue refunds and credits', noReadOnly: true },
  { name: 'Subscriptions', group: 'Order Management', description: 'Home Filter Club subscription orders' },
  { name: 'Marketplaces', group: 'Order Management', description: 'Marketplace order reports' },
  { name: 'Donations', group: 'Order Management', description: 'Donation dashboard' },
  { name: 'Locations', group: 'Order Management', description: 'Countries, states, tax rates, ship zones' },
  { name: 'Shipping', group: 'Order Management', description: 'Shipping methods, rates and carrier settings' },
  { name: 'Customers', group: 'Customer Management', description: 'Customer accounts', allowsRestricted: true },
  { name: 'TaxExemption', group: 'Customer Management', description: 'Grant tax-exempt status', noReadOnly: true },
  { name: 'Impersonate', group: 'Customer Management', description: 'Sign in as a customer' },
  { name: 'TokenizedCheckout', group: 'Customer Management', description: 'Use saved payment methods while impersonating', noReadOnly: true },
  { name: 'Reviews', group: 'Customer Management', description: 'Product reviews moderation' },
  { name: 'BackorderNotifications', group: 'Customer Management', description: 'Back-in-stock requests' },
  { name: 'InboundManager', group: 'Customer Management', description: 'Phone, chat and alert banner switches', noReadOnly: true, siteAdminGrantsFull: true },
  { name: 'Support', group: 'Customer Management', description: 'Support center articles and categories' },
  { name: 'Products', group: 'Product Management', description: 'Products, list by size, SxS export, search log, related products', allowsRestricted: true },
  { name: 'ProductCategories', group: 'Product Management', description: 'Categories and category FAQs' },
  { name: 'ProductOptions', group: 'Product Management', description: 'Options and option groups' },
  { name: 'ProductImages', group: 'Product Management', description: 'Image library' },
  { name: 'Redirects', group: 'Product Management', description: 'URL and search redirects', noReadOnly: true },
  { name: 'Promotions', group: 'Marketing Management', description: 'Promo codes and sales' },
  { name: 'Discounts', group: 'Marketing Management', description: 'Legacy order discounts' },
  { name: 'Deals', group: 'Marketing Management', description: 'Legacy deals' },
  { name: 'Affiliates', group: 'Marketing Management', description: 'Affiliate landing pages' },
  { name: 'Newsletter', group: 'Marketing Management', description: 'Newsletters and mailing list export' },
];

export const AREA_NAMES = AREAS.map((a) => a.name);
export const AREA_GROUPS = [...new Set(AREAS.map((a) => a.group))];

export const LEVEL_LABELS: Record<Level, string> = { [-1]: 'No access', 0: 'Read-only', 1: 'Full control', 2: 'Restricted control' };

export function parsePermissions(json: string | null | undefined): PermissionMap {
  if (!json) return {};
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    const out: PermissionMap = {};
    for (const [k, v] of Object.entries(obj)) {
      const n = Number(v);
      if (AREA_NAMES.includes(k) && [-1, 0, 1, 2].includes(n)) out[k] = n as Level;
    }
    return out;
  } catch {
    return {};
  }
}

/** Every area at full control. */
export function fullPermissions(): PermissionMap {
  return Object.fromEntries(AREA_NAMES.map((n) => [n, 1 as Level]));
}

export interface PermissionSubject {
  roleName?: string | null;
  /** effective map (role merged with overrides); missing area = -1 */
  permissions: PermissionMap;
  /** true when the admin has neither a role nor overrides, or holds the Site Administrator role */
  siteAdmin: boolean;
}

export function isSiteAdmin(s: PermissionSubject | null | undefined): boolean {
  return Boolean(s?.siteAdmin);
}

/** Merges role permissions with per-admin overrides and decides site-admin status. */
export function resolvePermissions(input: { roleId: number | null; roleName: string | null; rolePermissions: string | null; overrides: string | null }): PermissionSubject {
  const role = parsePermissions(input.rolePermissions);
  const over = parsePermissions(input.overrides);
  const siteAdmin = input.roleName === SITE_ADMIN_ROLE || (input.roleId === null && !input.overrides);
  return { roleName: input.roleName, permissions: siteAdmin ? fullPermissions() : { ...role, ...over }, siteAdmin };
}

export function levelFor(s: PermissionSubject | null | undefined, area: string): Level {
  if (!s) return -1;
  if (s.siteAdmin) return 1;
  return s.permissions[area] ?? -1;
}

/**
 * True when the subject may act at `min` for the area: `0` = may view, `1` = may write.
 * Restricted control (2) counts as "may view" and, for areas that define it, as a limited write
 * that the specific page decides on (e.g. Products level 2 = pricing only).
 */
export function can(s: PermissionSubject | null | undefined, area: string, min: 0 | 1 = 0): boolean {
  const l = levelFor(s, area);
  if (l === -1) return false;
  if (min === 0) return true;
  return l === 1;
}

/** Any of the areas is at least viewable: used to show or hide a nav group. */
export function canAny(s: PermissionSubject | null | undefined, areas: string[], min: 0 | 1 = 0): boolean {
  return areas.some((a) => can(s, a, min));
}

/** For Astro pages: returns a redirect Response when the admin may not view/write the area. */
export function denyUnless(locals: App.Locals, area: string, min: 0 | 1 = 0): Response | null {
  if (can(locals.admin, area, min)) return null;
  const msg = min === 1 ? `You need full control of "${area}" to do that.` : `You do not have access to "${area}".`;
  return new Response(null, { status: 302, headers: { Location: `/manager?denied=${encodeURIComponent(msg)}` } });
}

/** For Astro Actions: throws FORBIDDEN unless the admin may act. Returns the admin. */
export function requireArea(ctx: { locals: App.Locals }, area: string, min: 0 | 1 = 1) {
  const admin = ctx.locals.admin;
  if (!admin) throw new ActionError({ code: 'FORBIDDEN', message: 'Manager sign-in required' });
  if (!can(admin, area, min)) throw new ActionError({ code: 'FORBIDDEN', message: min === 1 ? `You need full control of "${area}" to do that.` : `You do not have access to "${area}".` });
  return admin;
}

/**
 * Read-access map for manager paths, checked by middleware so every page is gated even before it
 * calls `denyUnless`. Longest prefix wins. Writes are checked per action with `requireArea`.
 */
export const PAGE_AREAS: [prefix: string, areas: string[], min: 0 | 1][] = [
  ['/manager/settings', ['Setup'], 0],
  ['/manager/features', ['Mods', 'InboundManager'], 0],
  ['/manager/emails', ['Setup'], 0],
  ['/manager/reports', ['Statistics'], 0],
  ['/manager/inbound', ['Setup', 'Orders'], 0],
  ['/manager/admins', ['Admins'], 0],
  ['/manager/roles', ['Admins'], 0],
  ['/manager/sales-codes', ['Setup'], 1],
  ['/manager/images', ['ProductImages'], 0],
  ['/manager/orders', ['Orders'], 0],
  ['/manager/returns', ['Returns'], 0],
  ['/manager/credits', ['Credits'], 0],
  ['/manager/subscriptions', ['Subscriptions'], 0],
  ['/manager/locations', ['Locations'], 0],
  ['/manager/shipping', ['Shipping'], 0],
  ['/manager/customers', ['Customers'], 0],
  ['/manager/reviews', ['Reviews'], 0],
  ['/manager/backorders', ['BackorderNotifications'], 0],
  ['/manager/support', ['Support'], 0],
  ['/manager/categories', ['ProductCategories'], 0],
  ['/manager/products', ['Products'], 0],
  ['/manager/options', ['ProductOptions'], 0],
  ['/manager/faqs', ['Products', 'ProductCategories'], 0],
  ['/manager/redirects', ['Redirects'], 0],
  ['/manager/sizes', ['Products'], 1],
  ['/manager/sxs-export', ['Products'], 1],
  ['/manager/search-log', ['Products'], 0],
  ['/manager/related-products', ['Products'], 1],
  ['/manager/models', ['Products'], 0],
  ['/manager/promotions', ['Promotions'], 0],
  ['/manager/affiliates', ['Affiliates'], 0],
  ['/manager/newsletters', ['Newsletter'], 0],
];

/** The gate for a manager path, or null when the path is open to every signed-in admin. */
export function gateForPath(pathname: string): { areas: string[]; min: 0 | 1 } | null {
  let best: (typeof PAGE_AREAS)[number] | null = null;
  for (const entry of PAGE_AREAS) {
    const [prefix] = entry;
    if ((pathname === prefix || pathname.startsWith(prefix + '/')) && (!best || prefix.length > best[0].length)) best = entry;
  }
  return best ? { areas: best[1], min: best[2] } : null;
}

/** Levels a role/admin editor may offer for an area, honouring the legacy rules. */
export function offeredLevels(area: AreaDef, editorIsSiteAdmin: boolean): Level[] {
  const out: Level[] = [-1];
  if (!area.noReadOnly) out.push(0);
  if (!area.siteAdminGrantsFull || editorIsSiteAdmin) out.push(1);
  if (area.allowsRestricted) out.push(2);
  return out;
}
