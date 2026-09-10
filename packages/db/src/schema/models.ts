import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { products } from './catalog';

/**
 * Appliance model lookup (legacy tFridgeModelLookup).
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
    /** legacy Category free text: "Refrigerator", "Air Cleaner", … */
    applianceType: text('appliance_type'),
    noindex: integer('noindex', { mode: 'boolean' }).notNull().default(false),
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

/** Legacy refrigerator_finder: brand category → style → filter location → removal method → product. */
export const refrigeratorFinder = sqliteTable(
  'refrigerator_finder',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    brandCategoryId: integer('brand_category_id').notNull(), // legacy idBrand = idCategory of the brand page
    styleId: integer('style_id').notNull(),
    styleName: text('style_name').notNull(),
    locationId: integer('location_id').notNull(),
    locationName: text('location_name').notNull(),
    removalId: integer('removal_id').notNull(),
    removalName: text('removal_name').notNull(),
    removalImageUrl: text('removal_image_url'),
    productId: integer('product_id').notNull(),
    altProductId1: integer('alt_product_id_1'),
    altProductId2: integer('alt_product_id_2'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [index('refrigerator_finder_brand_idx').on(t.brandCategoryId)],
);

export const waterFilterTypes = sqliteTable('water_filter_types', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  imageUrl: text('image_url'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});

export const waterFilterSizes = sqliteTable(
  'water_filter_sizes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    typeId: integer('type_id').notNull(),
    length: real('length').notNull(),
    width: real('width').notNull(),
    imageUrl: text('image_url'),
  },
  (t) => [index('water_filter_sizes_type_idx').on(t.typeId)],
);

export const waterFilterFinder = sqliteTable(
  'water_filter_finder',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    categoryId: integer('category_id').notNull(),
    typeId: integer('type_id').notNull(),
    length: real('length').notNull(),
    width: real('width').notNull(),
    micron: real('micron'),
    productId: integer('product_id').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [index('water_filter_finder_cat_idx').on(t.categoryId, t.typeId)],
);

export const humidifierFinder = sqliteTable(
  'humidifier_finder',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    categoryId: integer('category_id').notNull(),
    length: real('length').notNull(),
    width: real('width').notNull(),
    thickness: real('thickness'),
    productId: integer('product_id').notNull(),
  },
  (t) => [index('humidifier_finder_cat_idx').on(t.categoryId)],
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
