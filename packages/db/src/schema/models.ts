import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { products } from './catalog';

/**
 * Appliance model lookup (legacy tFridgeModelLookup / tFridgeModelSearch / models).
 * `normalized` applies the legacy OCR-style normalisation (O→0, I/L→1, S→5, B→8,
 * punctuation stripped, upper-cased) so "wf-2cb" and "WF2CB" both resolve.
 */
export const applianceModels = sqliteTable(
  'appliance_models',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    modelNumber: text('model_number').notNull(),
    normalized: text('normalized').notNull(),
    brandName: text('brand_name'),
    /** refrigerator | water | humidifier | pool | other */
    applianceType: text('appliance_type'),
  },
  (t) => [uniqueIndex('appliance_models_number_idx').on(t.modelNumber), index('appliance_models_norm_idx').on(t.normalized)],
);

export const modelProducts = sqliteTable(
  'model_products',
  {
    modelId: integer('model_id')
      .notNull()
      .references(() => applianceModels.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    /** oem | compatible | accessory */
    relation: text('relation').notNull().default('compatible'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.modelId, t.productId] }), index('model_products_product_idx').on(t.productId)],
);

/** Legacy refrigerator_finder: brand → style → filter location → removal method → product. */
export const refrigeratorFinder = sqliteTable(
  'refrigerator_finder',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    brandName: text('brand_name').notNull(),
    style: text('style').notNull(),
    location: text('location').notNull(),
    removal: text('removal').notNull(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    imageUrl: text('image_url'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [index('refrigerator_finder_brand_idx').on(t.brandName)],
);

/** Stock air-filter sizes that have a shelf SKU (legacy search_products / actualSizes). */
export const airFilterSizes = sqliteTable(
  'air_filter_sizes',
  {
    key: text('key').primaryKey(), // "20x25x1"
    height: integer('height_x100').notNull(), // hundredths of an inch
    width: integer('width_x100').notNull(),
    depth: integer('depth_x100').notNull(),
    actualSize: text('actual_size'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
);
