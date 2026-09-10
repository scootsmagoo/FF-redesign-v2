import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Customer profile. Authentication (sessions, OAuth accounts, modern password
 * hashes) is owned by Better Auth's own tables; this table carries commerce
 * data and the legacy hash needed for first-login migration.
 */
export const customers = sqliteTable(
  'customers',
  {
    id: integer('id').primaryKey(), // legacy idCust
    email: text('email').notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    phone: text('phone'),
    company: text('company'),
    /** sha256 (unsalted, legacy SecureHash) | rc4 | none */
    legacyHashType: text('legacy_hash_type').notNull().default('none'),
    legacyHash: text('legacy_hash'),
    /** set once the customer signs in on v2 and is re-hashed by Better Auth */
    migratedAt: text('migrated_at'),
    newsletter: integer('newsletter', { mode: 'boolean' }).notNull().default(false),
    smsOptIn: integer('sms_opt_in', { mode: 'boolean' }).notNull().default(false),
    isEmployee: integer('is_employee', { mode: 'boolean' }).notNull().default(false),
    isMilitary: integer('is_military', { mode: 'boolean' }).notNull().default(false),
    reminderMonths: integer('reminder_months'),
    guest: integer('guest', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [uniqueIndex('customers_email_idx').on(t.email)],
);

export const addresses = sqliteTable(
  'addresses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    firstName: text('first_name'),
    lastName: text('last_name'),
    company: text('company'),
    line1: text('line1').notNull(),
    line2: text('line2'),
    city: text('city').notNull(),
    region: text('region').notNull(), // state/province code
    postalCode: text('postal_code').notNull(),
    country: text('country').notNull().default('US'),
    phone: text('phone'),
    isDefaultShipping: integer('is_default_shipping', { mode: 'boolean' }).notNull().default(false),
    isDefaultBilling: integer('is_default_billing', { mode: 'boolean' }).notNull().default(false),
    validatedAt: text('validated_at'),
  },
  (t) => [index('addresses_customer_idx').on(t.customerId)],
);

/** Saved payment methods: provider token references only, never card data. */
export const paymentMethods = sqliteTable(
  'payment_methods',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    /** cybersource | paypal */
    provider: text('provider').notNull(),
    providerToken: text('provider_token').notNull(),
    brand: text('brand'),
    last4: text('last4'),
    expMonth: integer('exp_month'),
    expYear: integer('exp_year'),
    nickname: text('nickname'),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [index('payment_methods_customer_idx').on(t.customerId)],
);

/** Customer's saved appliances (legacy customer_models / "Appliance Profile"). */
export const customerAppliances = sqliteTable(
  'customer_appliances',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    modelId: integer('model_id').notNull(),
    nickname: text('nickname'),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [index('customer_appliances_customer_idx').on(t.customerId)],
);
