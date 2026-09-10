import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { account, customers, schema, user } from '@ff/db';
import { env } from 'cloudflare:workers';
import { getDb } from './db';
import { LEGACY_PREFIX, verifyLegacyPassword } from '@ff/domain/legacy-password';
import { getProviders } from './providers';

type AuthEnv = { BETTER_AUTH_SECRET?: string; SITE_URL?: string; LEGACY_HASH_KEY?: string };
const cfg = env as unknown as AuthEnv;

let instance: ReturnType<typeof buildAuth> | undefined;

function buildAuth() {
  const db = getDb();
  const siteUrl = cfg.SITE_URL ?? 'http://localhost:4321';
  return betterAuth({
    appName: 'FiltersFast.com',
    baseURL: siteUrl,
    secret: cfg.BETTER_AUTH_SECRET ?? 'dev-only-secret-change-me',
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
    }),
    user: {
      additionalFields: {
        customerId: { type: 'number', required: false, input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 7, // legacy minimum, so old passwords keep working
      autoSignIn: true,
      password: {
        hash: (password) => hashPassword(password),
        // Legacy hashes (imported as `legacy:<type>:<hex>`) are checked with the old site's scheme;
        // the sign-in page then re-hashes with scrypt. Everything else is Better Auth's scrypt.
        verify: async ({ hash, password }) => {
          if (hash.startsWith(LEGACY_PREFIX)) return verifyLegacyPassword(hash, password, cfg.LEGACY_HASH_KEY);
          return verifyPassword({ hash, password });
        },
      },
      sendResetPassword: async ({ user: u, url }) => {
        await getProviders().email.send({
          to: u.email,
          subject: 'Reset your FiltersFast.com password',
          templateId: 'password-reset',
          templateData: { url, name: u.name },
          html: `<p>Hi ${u.name || 'there'},</p><p><a href="${url}">Reset your password</a>. This link expires in one hour. If you didn't ask for this, you can ignore it.</p>`,
        });
      },
      resetPasswordTokenExpiresIn: 60 * 60,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },
    advanced: {
      cookiePrefix: 'ff',
      useSecureCookies: siteUrl.startsWith('https://'),
    },
    databaseHooks: {
      user: {
        create: {
          /** Link a new auth user to an existing commerce customer by email, or create one. */
          before: async (u) => {
            const email = u.email.toLowerCase();
            const existing = await db.select({ id: customers.id }).from(customers).where(eq(customers.email, email)).limit(1);
            let customerId = existing[0]?.id;
            if (!customerId) {
              const [first = '', ...rest] = (u.name ?? '').trim().split(/\s+/);
              const inserted = await db
                .insert(customers)
                .values({ email, firstName: first || null, lastName: rest.join(' ') || null, legacyHashType: 'none' })
                .returning({ id: customers.id });
              customerId = inserted[0]?.id;
            }
            return { data: { ...u, email, customerId } };
          },
        },
      },
    },
  });
}

export function getAuth() {
  instance ??= buildAuth();
  return instance;
}

export type Auth = ReturnType<typeof getAuth>;
export type SessionUser = { id: string; email: string; name: string; customerId?: number | null };

/** After a successful sign-in with a legacy hash, store a scrypt hash so the legacy key is never needed again. */
export async function upgradeLegacyPassword(userId: string, password: string): Promise<void> {
  const db = getDb();
  const rows = await db.select({ id: account.id, password: account.password, providerId: account.providerId }).from(account).where(eq(account.userId, userId));
  const legacy = rows.find((a) => a.providerId === 'credential' && a.password?.startsWith(LEGACY_PREFIX));
  if (!legacy) return;
  await db.update(account).set({ password: await hashPassword(password), updatedAt: new Date() }).where(eq(account.id, legacy.id));
}

/** True when the credential account still carries a legacy hash and no key is configured to check it. */
export async function needsPasswordReset(email: string): Promise<boolean> {
  if (cfg.LEGACY_HASH_KEY) return false;
  const db = getDb();
  const u = await db.select({ id: user.id }).from(user).where(eq(user.email, email.toLowerCase())).limit(1);
  if (!u[0]) return false;
  const rows = await db.select({ password: account.password }).from(account).where(eq(account.userId, u[0].id));
  return rows.some((a) => a.password?.startsWith(LEGACY_PREFIX));
}

/**
 * Copies Set-Cookie headers from a Better Auth response onto a redirect so server-rendered
 * forms (no client JS) can sign in, sign out, and reset passwords.
 */
export function redirectWithAuthCookies(from: Response, location: string, status = 303): Response {
  const headers = new Headers({ Location: location });
  for (const c of from.headers.getSetCookie()) headers.append('Set-Cookie', c);
  return new Response(null, { status, headers });
}
