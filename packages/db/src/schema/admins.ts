import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Back-office staff (legacy cp_admins). Completely separate from customer sign-in:
 * different table, password store and session cookie, reached only via /manager.
 * Passwords are scrypt hashes (better-auth/crypto), never the legacy reversible RC4.
 */
export const admins = sqliteTable(
  'admins',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull(), // work address, lower-cased
    name: text('name'),
    passwordHash: text('password_hash').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    /** set when created or reset with a temporary password; the portal forces a change */
    mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(false),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: text('locked_until'),
    lastLoginAt: text('last_login_at'),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
    updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [uniqueIndex('admins_email_idx').on(t.email)],
);

/** Server-side sessions for the manager cookie; `id` is the SHA-256 of the cookie token. */
export const adminSessions = sqliteTable(
  'admin_sessions',
  {
    id: text('id').primaryKey(),
    adminId: integer('admin_id')
      .notNull()
      .references(() => admins.id, { onDelete: 'cascade' }),
    expiresAt: text('expires_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [index('admin_sessions_admin_idx').on(t.adminId), index('admin_sessions_expires_idx').on(t.expiresAt)],
);
