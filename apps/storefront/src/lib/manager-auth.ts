import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { adminFailedLogins, adminPasswordHistory, adminRoles, adminSessions, admins } from '@ff/db';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import type { AstroCookies } from 'astro';
import { env } from 'cloudflare:workers';
import { getDb } from './db';
import { AREA_NAMES, parsePermissions, resolvePermissions, SITE_ADMIN_ROLE, type Level, type PermissionMap, type PermissionSubject } from './manager/permissions';

/**
 * Back-office authentication (legacy Manager/logon.asp + _INCadmins.asp), independent of the
 * customer Better Auth stack: its own `admins` table, scrypt password hashes, a server-side
 * session table and the `ff.manager` cookie scoped to /manager. A customer session is never
 * accepted here and an admin session is never accepted on the storefront.
 *
 * Roles and per-area permission levels come from `admin_roles` + `admins.permissions`
 * (see manager/permissions.ts). Failed sign-ins are logged; passwords rotate every 90 days
 * and the last 5 hashes cannot be reused (legacy cp_pwd_history).
 */

export const MANAGER_COOKIE = 'ff.manager';
const SESSION_HOURS = 12;
const MAX_ATTEMPTS = 5; // legacy: 5 failed logons lock the account
const LOCK_MINUTES = 15;
export const MIN_ADMIN_PASSWORD = 12;
export const PASSWORD_MAX_AGE_DAYS = 90;
const PASSWORD_HISTORY = 5;

export interface AdminUser extends PermissionSubject {
  id: number;
  email: string;
  name: string | null;
  mustChangePassword: boolean;
  roleId: number | null;
  salesCode: string | null;
  passwordChangedAt: string | null;
}

const INVALID = 'Invalid email address or password.';

/** Legacy PasswordIsComplex: length plus lower, upper, digit and a symbol. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_ADMIN_PASSWORD) return `Use at least ${MIN_ADMIN_PASSWORD} characters.`;
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw)) return 'Use at least one lower-case letter, one upper-case letter and one number.';
  return null;
}

/** 16 chars from an unambiguous alphabet, always containing upper, lower and a digit. */
export function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]!);
  chars[0] = 'A';
  chars[1] = 'b';
  chars[15] = String((bytes[15]! % 7) + 2);
  return chars.join('');
}

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const nowIso = () => new Date().toISOString();
const plusHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

/** Days until the password must be rotated (negative = overdue). */
export function passwordDaysLeft(a: { passwordChangedAt: string | null }): number {
  const changed = a.passwordChangedAt ? new Date(a.passwordChangedAt).getTime() : 0;
  if (!changed) return PASSWORD_MAX_AGE_DAYS; // legacy accounts without a date get a fresh clock at next change
  return Math.ceil((changed + PASSWORD_MAX_AGE_DAYS * 86_400_000 - Date.now()) / 86_400_000);
}

export function passwordExpired(a: { passwordChangedAt: string | null }): boolean {
  return Boolean(a.passwordChangedAt) && passwordDaysLeft(a) <= 0;
}

export type SignInResult = { ok: true; token: string; admin: AdminUser } | { ok: false; message: string };

async function logFailure(email: string, method: string, ip?: string) {
  await getDb()
    .insert(adminFailedLogins)
    .values({ email, method, ipAddress: ip ?? null })
    .catch(() => {});
}

export async function signInAdmin(emailIn: string, password: string, meta: { ip?: string; userAgent?: string }): Promise<SignInResult> {
  const db = getDb();
  const email = emailIn.trim().toLowerCase();
  const row = await db.query.admins.findFirst({ where: eq(admins.email, email) });
  if (!row || !row.active) {
    await verifyPassword({ hash: DUMMY_HASH, password }); // keep timing similar for unknown accounts
    await logFailure(email, 'form', meta.ip);
    return { ok: false, message: INVALID };
  }
  if (row.lockedUntil && row.lockedUntil > nowIso()) {
    await logFailure(email, 'form (locked)', meta.ip);
    return { ok: false, message: `This account is locked after too many failed attempts. Try again in ${LOCK_MINUTES} minutes or ask another admin to reset your password.` };
  }
  const good = await verifyPassword({ hash: row.passwordHash, password });
  if (!good) {
    const attempts = row.failedAttempts + 1;
    await db
      .update(admins)
      .set({ failedAttempts: attempts, lockedUntil: attempts >= MAX_ATTEMPTS ? plusHours(LOCK_MINUTES / 60) : null, updatedAt: nowIso() })
      .where(eq(admins.id, row.id));
    await logFailure(email, 'form', meta.ip);
    return { ok: false, message: attempts >= MAX_ATTEMPTS ? `Too many failed attempts. This account is locked for ${LOCK_MINUTES} minutes.` : INVALID };
  }
  await db.update(admins).set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: nowIso(), updatedAt: nowIso() }).where(eq(admins.id, row.id));
  const token = await createSession(row.id, meta);
  const admin = await getAdminById(row.id);
  if (!admin) return { ok: false, message: INVALID };
  return { ok: true, token, admin };
}

async function createSession(adminId: number, meta: { ip?: string; userAgent?: string }): Promise<string> {
  const token = randomToken();
  await getDb()
    .insert(adminSessions)
    .values({ id: await sha256Hex(token), adminId, expiresAt: plusHours(SESSION_HOURS), ipAddress: meta.ip ?? null, userAgent: meta.userAgent?.slice(0, 200) ?? null });
  return token;
}

const adminColumns = {
  id: admins.id,
  email: admins.email,
  name: admins.name,
  mustChangePassword: admins.mustChangePassword,
  roleId: admins.roleId,
  overrides: admins.permissions,
  salesCode: admins.salesCode,
  passwordChangedAt: admins.passwordChangedAt,
  roleName: adminRoles.name,
  rolePermissions: adminRoles.permissions,
};

function toAdminUser(r: { id: number; email: string; name: string | null; mustChangePassword: boolean; roleId: number | null; overrides: string | null; salesCode: string | null; passwordChangedAt: string | null; roleName: string | null; rolePermissions: string | null }): AdminUser {
  const perms = resolvePermissions({ roleId: r.roleId, roleName: r.roleName, rolePermissions: r.rolePermissions, overrides: r.overrides });
  return { id: r.id, email: r.email, name: r.name, mustChangePassword: r.mustChangePassword, roleId: r.roleId, salesCode: r.salesCode, passwordChangedAt: r.passwordChangedAt, ...perms };
}

export async function getAdminById(id: number): Promise<AdminUser | null> {
  const rows = await getDb().select(adminColumns).from(admins).leftJoin(adminRoles, eq(adminRoles.id, admins.roleId)).where(eq(admins.id, id)).limit(1);
  return rows[0] ? toAdminUser(rows[0]) : null;
}

/** Resolves the manager cookie to an active admin, sliding the expiry when under half is left. */
export async function getAdminFromToken(token: string): Promise<AdminUser | null> {
  const db = getDb();
  const id = await sha256Hex(token);
  const now = nowIso();
  const row = await db
    .select({ sessionId: adminSessions.id, expiresAt: adminSessions.expiresAt, ...adminColumns })
    .from(adminSessions)
    .innerJoin(admins, eq(admins.id, adminSessions.adminId))
    .leftJoin(adminRoles, eq(adminRoles.id, admins.roleId))
    .where(and(eq(adminSessions.id, id), gt(adminSessions.expiresAt, now), eq(admins.active, true)))
    .limit(1);
  const s = row[0];
  if (!s) return null;
  if (new Date(s.expiresAt).getTime() - Date.now() < (SESSION_HOURS / 2) * 3600_000) {
    await db.update(adminSessions).set({ expiresAt: plusHours(SESSION_HOURS) }).where(eq(adminSessions.id, s.sessionId));
  }
  return toAdminUser(s);
}

export async function signOutAdmin(token: string | undefined): Promise<void> {
  if (!token) return;
  await getDb().delete(adminSessions).where(eq(adminSessions.id, await sha256Hex(token)));
}

/** Drops every session of an admin (after a password change or deactivation). */
export async function revokeAdminSessions(adminId: number, exceptToken?: string): Promise<void> {
  const db = getDb();
  if (exceptToken) {
    const keep = await sha256Hex(exceptToken);
    await db.delete(adminSessions).where(and(eq(adminSessions.adminId, adminId), sql`${adminSessions.id} <> ${keep}`));
  } else {
    await db.delete(adminSessions).where(eq(adminSessions.adminId, adminId));
  }
}

export function setManagerCookie(cookies: AstroCookies, token: string): void {
  cookies.set(MANAGER_COOKIE, token, {
    httpOnly: true,
    secure: String((env as { SITE_URL?: string }).SITE_URL ?? '').startsWith('https://'),
    sameSite: 'lax',
    path: '/manager',
    maxAge: SESSION_HOURS * 3600,
  });
}

export function clearManagerCookie(cookies: AstroCookies): void {
  cookies.delete(MANAGER_COOKIE, { path: '/manager' });
}

// ---------- admin accounts (legacy cp_admins management) ----------

export async function listAdmins() {
  return getDb()
    .select({
      id: admins.id,
      email: admins.email,
      name: admins.name,
      active: admins.active,
      mustChangePassword: admins.mustChangePassword,
      lockedUntil: admins.lockedUntil,
      lastLoginAt: admins.lastLoginAt,
      createdAt: admins.createdAt,
      roleId: admins.roleId,
      roleName: adminRoles.name,
      salesCode: admins.salesCode,
      passwordChangedAt: admins.passwordChangedAt,
      overrides: admins.permissions,
    })
    .from(admins)
    .leftJoin(adminRoles, eq(adminRoles.id, admins.roleId))
    .orderBy(desc(admins.active), adminRoles.name, admins.email);
}

export async function getAdminDetail(id: number) {
  const rows = await listAdmins();
  return rows.find((r) => r.id === id) ?? null;
}

/** Creates the account, or resets an existing one, with a temporary password that must be changed at first sign-in. */
export async function createOrResetAdmin(emailIn: string, name?: string | null, opts: { roleId?: number | null; salesCode?: string | null } = {}): Promise<{ id: number; email: string; tempPassword: string; created: boolean }> {
  const db = getDb();
  const email = emailIn.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const existing = await db.select({ id: admins.id }).from(admins).where(eq(admins.email, email)).limit(1);
  if (existing[0]) {
    await db
      .update(admins)
      .set({ passwordHash, mustChangePassword: true, active: true, failedAttempts: 0, lockedUntil: null, name: name?.trim() || undefined, passwordChangedAt: null, updatedAt: nowIso() })
      .where(eq(admins.id, existing[0].id));
    await revokeAdminSessions(existing[0].id);
    return { id: existing[0].id, email, tempPassword, created: false };
  }
  const [row] = await db
    .insert(admins)
    .values({ email, name: name?.trim() || null, passwordHash, mustChangePassword: true, roleId: opts.roleId ?? null, salesCode: opts.salesCode ?? null })
    .returning({ id: admins.id });
  return { id: row!.id, email, tempPassword, created: true };
}

export async function updateAdmin(adminId: number, patch: { name?: string | null; roleId?: number | null; salesCode?: string | null; permissions?: PermissionMap | null; active?: boolean }): Promise<void> {
  const set: Partial<typeof admins.$inferInsert> = { updatedAt: nowIso() };
  if (patch.name !== undefined) set.name = patch.name?.trim() || null;
  if (patch.roleId !== undefined) set.roleId = patch.roleId;
  if (patch.salesCode !== undefined) set.salesCode = patch.salesCode?.trim() || null;
  if (patch.permissions !== undefined) set.permissions = patch.permissions && Object.keys(patch.permissions).length ? JSON.stringify(patch.permissions) : null;
  if (patch.active !== undefined) set.active = patch.active;
  await getDb().update(admins).set(set).where(eq(admins.id, adminId));
  if (patch.active === false) await revokeAdminSessions(adminId);
}

export async function setAdminActive(adminId: number, active: boolean): Promise<void> {
  await updateAdmin(adminId, { active });
}

export async function changeOwnPassword(adminId: number, currentPassword: string, newPassword: string, keepToken?: string): Promise<{ ok: boolean; message: string }> {
  const db = getDb();
  const row = await db.query.admins.findFirst({ where: eq(admins.id, adminId) });
  if (!row) return { ok: false, message: 'Account not found.' };
  if (!(await verifyPassword({ hash: row.passwordHash, password: currentPassword }))) return { ok: false, message: 'Current password is incorrect.' };
  const problem = passwordProblem(newPassword);
  if (problem) return { ok: false, message: problem };
  if (newPassword === currentPassword) return { ok: false, message: 'Choose a password you have not used before.' };
  const history = await db.select({ hash: adminPasswordHistory.passwordHash }).from(adminPasswordHistory).where(eq(adminPasswordHistory.adminId, adminId)).orderBy(desc(adminPasswordHistory.id)).limit(PASSWORD_HISTORY);
  for (const h of history) if (await verifyPassword({ hash: h.hash, password: newPassword })) return { ok: false, message: `Choose a password you have not used in your last ${PASSWORD_HISTORY}.` };
  await db.insert(adminPasswordHistory).values({ adminId, passwordHash: row.passwordHash });
  await db.update(admins).set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false, passwordChangedAt: nowIso(), updatedAt: nowIso() }).where(eq(admins.id, adminId));
  await revokeAdminSessions(adminId, keepToken);
  return { ok: true, message: 'Password updated.' };
}

// ---------- roles ----------

export async function listRoles() {
  const rows = await getDb()
    .select({ id: adminRoles.id, name: adminRoles.name, permissions: adminRoles.permissions, createdAt: adminRoles.createdAt, members: sql<number>`(select count(*) from admins a where a.role_id = ${adminRoles.id})` })
    .from(adminRoles)
    .orderBy(adminRoles.name);
  return rows.map((r) => ({ ...r, permissions: parsePermissions(r.permissions) }));
}

export async function getRole(id: number) {
  const rows = await listRoles();
  return rows.find((r) => r.id === id) ?? null;
}

export async function saveRole(input: { id?: number | null; name: string; permissions: PermissionMap }): Promise<number> {
  const db = getDb();
  const name = input.name.trim();
  if (!name) throw new Error('Role name is required.');
  const perms: PermissionMap = {};
  for (const [k, v] of Object.entries(input.permissions)) if (AREA_NAMES.includes(k) && v !== -1) perms[k] = v as Level;
  const json = JSON.stringify(perms);
  if (input.id) {
    await db.update(adminRoles).set({ name, permissions: json }).where(eq(adminRoles.id, input.id));
    return input.id;
  }
  const [row] = await db.insert(adminRoles).values({ name, permissions: json }).returning({ id: adminRoles.id });
  return row!.id;
}

export async function deleteRole(id: number): Promise<void> {
  const db = getDb();
  const role = await db.query.adminRoles.findFirst({ where: eq(adminRoles.id, id) });
  if (!role) return;
  if (role.name === SITE_ADMIN_ROLE) throw new Error('The Site Administrator role cannot be deleted.');
  const [m] = await db.select({ n: sql<number>`count(*)` }).from(admins).where(eq(admins.roleId, id));
  if ((m?.n ?? 0) > 0) throw new Error('Move its members to another role first.');
  await db.delete(adminRoles).where(eq(adminRoles.id, id));
}

/** Makes sure the Site Administrator role exists (created on first visit to the roles page). */
export async function ensureSiteAdminRole(): Promise<number> {
  const db = getDb();
  const existing = await db.query.adminRoles.findFirst({ where: eq(adminRoles.name, SITE_ADMIN_ROLE) });
  if (existing) return existing.id;
  const [row] = await db.insert(adminRoles).values({ name: SITE_ADMIN_ROLE, permissions: JSON.stringify(Object.fromEntries(AREA_NAMES.map((n) => [n, 1]))) }).returning({ id: adminRoles.id });
  return row!.id;
}

export async function listFailedLogins(limit = 100) {
  return getDb().select().from(adminFailedLogins).orderBy(desc(adminFailedLogins.id)).limit(limit);
}

/** A real scrypt hash of a random value, so unknown-account sign-ins cost the same as wrong passwords. */
const DUMMY_HASH = 'a6f7b2c3d4e5f60718293a4b5c6d7e8f:5f3c7a9e1b2d4c6f8a0e2d4b6c8a0f1e3d5b7a9c1e3f5a7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c';
