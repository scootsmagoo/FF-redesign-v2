import { and, eq, gt, sql } from 'drizzle-orm';
import { adminSessions, admins } from '@ff/db';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import type { AstroCookies } from 'astro';
import { env } from 'cloudflare:workers';
import { getDb } from './db';

/**
 * Back-office authentication (legacy Manager/logon.asp + _INCadmins.asp), independent of the
 * customer Better Auth stack: its own `admins` table, scrypt password hashes, a server-side
 * session table and the `ff.manager` cookie scoped to /manager. A customer session is never
 * accepted here and an admin session is never accepted on the storefront.
 */

export const MANAGER_COOKIE = 'ff.manager';
const SESSION_HOURS = 12;
const MAX_ATTEMPTS = 5; // legacy: 5 failed logons lock the account
const LOCK_MINUTES = 15;
export const MIN_ADMIN_PASSWORD = 12;

export interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  mustChangePassword: boolean;
}

const INVALID = 'Invalid email address or password.';

/** Legacy PasswordIsComplex, simplified: length plus at least one letter and one digit. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_ADMIN_PASSWORD) return `Use at least ${MIN_ADMIN_PASSWORD} characters.`;
  if (!/[a-z]/i.test(pw) || !/\d/.test(pw)) return 'Use at least one letter and one number.';
  return null;
}

/** 16 chars from an unambiguous alphabet, always containing a letter and a digit. */
export function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]!);
  chars[0] = 'Ab'[bytes[0]! % 2]!;
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

export type SignInResult = { ok: true; token: string; admin: AdminUser } | { ok: false; message: string };

export async function signInAdmin(emailIn: string, password: string, meta: { ip?: string; userAgent?: string }): Promise<SignInResult> {
  const db = getDb();
  const email = emailIn.trim().toLowerCase();
  const row = await db.query.admins.findFirst({ where: eq(admins.email, email) });
  if (!row || !row.active) {
    await verifyPassword({ hash: DUMMY_HASH, password }); // keep timing similar for unknown accounts
    return { ok: false, message: INVALID };
  }
  if (row.lockedUntil && row.lockedUntil > nowIso()) {
    return { ok: false, message: `This account is locked after too many failed attempts. Try again in ${LOCK_MINUTES} minutes or ask another admin to reset your password.` };
  }
  const good = await verifyPassword({ hash: row.passwordHash, password });
  if (!good) {
    const attempts = row.failedAttempts + 1;
    await db
      .update(admins)
      .set({ failedAttempts: attempts, lockedUntil: attempts >= MAX_ATTEMPTS ? plusHours(LOCK_MINUTES / 60) : null, updatedAt: nowIso() })
      .where(eq(admins.id, row.id));
    return { ok: false, message: attempts >= MAX_ATTEMPTS ? `Too many failed attempts. This account is locked for ${LOCK_MINUTES} minutes.` : INVALID };
  }
  await db.update(admins).set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: nowIso(), updatedAt: nowIso() }).where(eq(admins.id, row.id));
  const token = await createSession(row.id, meta);
  return { ok: true, token, admin: { id: row.id, email: row.email, name: row.name, mustChangePassword: row.mustChangePassword } };
}

async function createSession(adminId: number, meta: { ip?: string; userAgent?: string }): Promise<string> {
  const token = randomToken();
  await getDb()
    .insert(adminSessions)
    .values({ id: await sha256Hex(token), adminId, expiresAt: plusHours(SESSION_HOURS), ipAddress: meta.ip ?? null, userAgent: meta.userAgent?.slice(0, 200) ?? null });
  return token;
}

/** Resolves the manager cookie to an active admin, sliding the expiry when under half is left. */
export async function getAdminFromToken(token: string): Promise<AdminUser | null> {
  const db = getDb();
  const id = await sha256Hex(token);
  const now = nowIso();
  const row = await db
    .select({ sessionId: adminSessions.id, expiresAt: adminSessions.expiresAt, adminId: admins.id, email: admins.email, name: admins.name, mustChangePassword: admins.mustChangePassword })
    .from(adminSessions)
    .innerJoin(admins, eq(admins.id, adminSessions.adminId))
    .where(and(eq(adminSessions.id, id), gt(adminSessions.expiresAt, now), eq(admins.active, true)))
    .limit(1);
  const s = row[0];
  if (!s) return null;
  if (new Date(s.expiresAt).getTime() - Date.now() < (SESSION_HOURS / 2) * 3600_000) {
    await db.update(adminSessions).set({ expiresAt: plusHours(SESSION_HOURS) }).where(eq(adminSessions.id, s.sessionId));
  }
  return { id: s.adminId, email: s.email, name: s.name, mustChangePassword: s.mustChangePassword };
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
    .select({ id: admins.id, email: admins.email, name: admins.name, active: admins.active, mustChangePassword: admins.mustChangePassword, lockedUntil: admins.lockedUntil, lastLoginAt: admins.lastLoginAt, createdAt: admins.createdAt })
    .from(admins)
    .orderBy(admins.email);
}

/** Creates the account, or resets an existing one, with a temporary password that must be changed at first sign-in. */
export async function createOrResetAdmin(emailIn: string, name?: string | null): Promise<{ id: number; email: string; tempPassword: string; created: boolean }> {
  const db = getDb();
  const email = emailIn.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const existing = await db.select({ id: admins.id }).from(admins).where(eq(admins.email, email)).limit(1);
  if (existing[0]) {
    await db
      .update(admins)
      .set({ passwordHash, mustChangePassword: true, active: true, failedAttempts: 0, lockedUntil: null, name: name?.trim() || undefined, updatedAt: nowIso() })
      .where(eq(admins.id, existing[0].id));
    await revokeAdminSessions(existing[0].id);
    return { id: existing[0].id, email, tempPassword, created: false };
  }
  const [row] = await db.insert(admins).values({ email, name: name?.trim() || null, passwordHash, mustChangePassword: true }).returning({ id: admins.id });
  return { id: row!.id, email, tempPassword, created: true };
}

export async function setAdminActive(adminId: number, active: boolean): Promise<void> {
  await getDb().update(admins).set({ active, updatedAt: nowIso() }).where(eq(admins.id, adminId));
  if (!active) await revokeAdminSessions(adminId);
}

export async function changeOwnPassword(adminId: number, currentPassword: string, newPassword: string, keepToken?: string): Promise<{ ok: boolean; message: string }> {
  const db = getDb();
  const row = await db.query.admins.findFirst({ where: eq(admins.id, adminId) });
  if (!row) return { ok: false, message: 'Account not found.' };
  if (!(await verifyPassword({ hash: row.passwordHash, password: currentPassword }))) return { ok: false, message: 'Current password is incorrect.' };
  const problem = passwordProblem(newPassword);
  if (problem) return { ok: false, message: problem };
  if (newPassword === currentPassword) return { ok: false, message: 'Choose a password you have not used before.' };
  await db.update(admins).set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false, updatedAt: nowIso() }).where(eq(admins.id, adminId));
  await revokeAdminSessions(adminId, keepToken);
  return { ok: true, message: 'Password updated.' };
}

/** A real scrypt hash of a random value, so unknown-account sign-ins cost the same as wrong passwords. */
const DUMMY_HASH = 'a6f7b2c3d4e5f60718293a4b5c6d7e8f:5f3c7a9e1b2d4c6f8a0e2d4b6c8a0f1e3d5b7a9c1e3f5a7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c';
