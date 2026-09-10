import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** Exact-path redirects that the pattern rules in @ff/domain cannot derive. */
export const redirects = sqliteTable(
  'redirects',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    fromPath: text('from_path').notNull(),
    toPath: text('to_path').notNull(),
    status: integer('status').notNull().default(301),
    /** product | category | keyword | manual */
    kind: text('kind').notNull().default('manual'),
    hits: integer('hits').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [uniqueIndex('redirects_from_idx').on(t.fromPath)],
);

/** Replaces the legacy storeAdmin.configValLong blob and the hardcoded promo/holiday switches. */
export const siteSettings = sqliteTable('site_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // JSON
  description: text('description'),
  updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
});

export const faqs = sqliteTable(
  'faqs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** site | product | category */
    scope: text('scope').notNull(),
    scopeId: integer('scope_id'),
    question: text('question').notNull(),
    answerHtml: text('answer_html').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [index('faqs_scope_idx').on(t.scope, t.scopeId)],
);

/** Native review store; Trustpilot sync writes here too so PDPs render without a live API call. */
export const reviews = sqliteTable(
  'reviews',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id').notNull(),
    /** legacy | trustpilot */
    source: text('source').notNull().default('legacy'),
    externalId: text('external_id'),
    rating: integer('rating').notNull(),
    title: text('title'),
    body: text('body'),
    authorName: text('author_name'),
    verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    approved: integer('approved', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [index('reviews_product_idx').on(t.productId), uniqueIndex('reviews_external_idx').on(t.source, t.externalId)],
);

/** Every search query and how the redirect layer resolved it (legacy tffsearchparam). */
export const searchLog = sqliteTable(
  'search_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    query: text('query').notNull(),
    normalized: text('normalized'),
    /** sku | model | keyword | size | custom | search */
    outcome: text('outcome').notNull(),
    redirectTo: text('redirect_to'),
    resultCount: integer('result_count'),
    country: text('country'),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [index('search_log_created_idx').on(t.createdAt)],
);
