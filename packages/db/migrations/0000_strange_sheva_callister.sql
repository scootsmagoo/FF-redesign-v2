CREATE TABLE `brands` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo_url` text,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brands_slug_idx` ON `brands` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `brands_name_idx` ON `brands` (`name`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY NOT NULL,
	`parent_id` integer,
	`name` text NOT NULL,
	`h1` text,
	`slug` text NOT NULL,
	`legacy_slug` text,
	`description_html` text,
	`image_url` text,
	`meta_title` text,
	`meta_description` text,
	`kind` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`compare_active` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_idx` ON `categories` (`slug`);--> statement-breakpoint
CREATE INDEX `categories_parent_idx` ON `categories` (`parent_id`);--> statement-breakpoint
CREATE TABLE `category_products` (
	`category_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`category_id`, `product_id`),
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `category_products_product_idx` ON `category_products` (`product_id`);--> statement-breakpoint
CREATE TABLE `compatible_skus` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`brand` text NOT NULL,
	`sku` text NOT NULL,
	`sku_normalized` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `compatible_skus_product_idx` ON `compatible_skus` (`product_id`);--> statement-breakpoint
CREATE INDEX `compatible_skus_norm_idx` ON `compatible_skus` (`sku_normalized`);--> statement-breakpoint
CREATE TABLE `option_groups` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`display_type` text DEFAULT 'select' NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	`sizing_link` text
);
--> statement-breakpoint
CREATE TABLE `options` (
	`id` integer PRIMARY KEY NOT NULL,
	`group_id` integer NOT NULL,
	`label` text NOT NULL,
	`price_add_cents` integer DEFAULT 0 NOT NULL,
	`percent_add` real DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `option_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `options_group_idx` ON `options` (`group_id`);--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`url` text NOT NULL,
	`alt` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_images_product_idx` ON `product_images` (`product_id`);--> statement-breakpoint
CREATE TABLE `product_option_groups` (
	`product_id` integer NOT NULL,
	`group_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`product_id`, `group_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `option_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `product_options` (
	`product_id` integer NOT NULL,
	`option_id` integer NOT NULL,
	`sku` text,
	`stock` integer,
	`excluded` integer DEFAULT false NOT NULL,
	`price_override_cents` integer,
	PRIMARY KEY(`product_id`, `option_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`option_id`) REFERENCES `options`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `product_specs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`name` text NOT NULL,
	`value` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_specs_product_idx` ON `product_specs` (`product_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`legacy_slug` text,
	`brand_id` integer,
	`brand_name` text,
	`description_html` text,
	`short_description` text,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`list_price_cents` integer,
	`as_low_as_cents` integer,
	`image_url` text,
	`thumb_url` text,
	`stock` integer DEFAULT 0 NOT NULL,
	`ignore_stock` integer DEFAULT false NOT NULL,
	`lead_time_days` integer,
	`free_shipping` integer DEFAULT false NOT NULL,
	`private_label` integer DEFAULT false NOT NULL,
	`pack_qty` integer DEFAULT 1 NOT NULL,
	`pack_uom` text,
	`autoship_enabled` integer DEFAULT false NOT NULL,
	`compare_to_id` integer,
	`compare_to_alt_id` integer,
	`replacement_for_id` integer,
	`pop_rank` integer DEFAULT 9999 NOT NULL,
	`weight_oz` real,
	`prop65` integer DEFAULT false NOT NULL,
	`made_in_usa` integer DEFAULT false NOT NULL,
	`tax_exempt` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`meta_title` text,
	`meta_description` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_idx` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `products_sku_idx` ON `products` (`sku`);--> statement-breakpoint
CREATE INDEX `products_brand_idx` ON `products` (`brand_id`);--> statement-breakpoint
CREATE INDEX `products_pop_idx` ON `products` (`pop_rank`);--> statement-breakpoint
CREATE TABLE `quantity_tiers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`from_qty` integer NOT NULL,
	`to_qty` integer,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`discount_percent` real DEFAULT 0 NOT NULL,
	`source` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quantity_tiers_product_idx` ON `quantity_tiers` (`product_id`);--> statement-breakpoint
CREATE TABLE `related_products` (
	`product_id` integer NOT NULL,
	`related_product_id` integer NOT NULL,
	`kind` text DEFAULT 'related' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`product_id`, `related_product_id`, `kind`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`related_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `air_filter_sizes` (
	`key` text PRIMARY KEY NOT NULL,
	`height_x100` integer NOT NULL,
	`width_x100` integer NOT NULL,
	`depth_x100` integer NOT NULL,
	`actual_size` text,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `appliance_models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`model_number` text NOT NULL,
	`normalized` text NOT NULL,
	`brand_name` text,
	`appliance_type` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appliance_models_number_idx` ON `appliance_models` (`model_number`);--> statement-breakpoint
CREATE INDEX `appliance_models_norm_idx` ON `appliance_models` (`normalized`);--> statement-breakpoint
CREATE TABLE `model_products` (
	`model_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`relation` text DEFAULT 'compatible' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`model_id`, `product_id`),
	FOREIGN KEY (`model_id`) REFERENCES `appliance_models`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `model_products_product_idx` ON `model_products` (`product_id`);--> statement-breakpoint
CREATE TABLE `refrigerator_finder` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_name` text NOT NULL,
	`style` text NOT NULL,
	`location` text NOT NULL,
	`removal` text NOT NULL,
	`product_id` integer NOT NULL,
	`image_url` text,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `refrigerator_finder_brand_idx` ON `refrigerator_finder` (`brand_name`);--> statement-breakpoint
CREATE TABLE `faqs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scope` text NOT NULL,
	`scope_id` integer,
	`question` text NOT NULL,
	`answer_html` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `faqs_scope_idx` ON `faqs` (`scope`,`scope_id`);--> statement-breakpoint
CREATE TABLE `redirects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from_path` text NOT NULL,
	`to_path` text NOT NULL,
	`status` integer DEFAULT 301 NOT NULL,
	`kind` text DEFAULT 'manual' NOT NULL,
	`hits` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `redirects_from_idx` ON `redirects` (`from_path`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`source` text DEFAULT 'legacy' NOT NULL,
	`external_id` text,
	`rating` integer NOT NULL,
	`title` text,
	`body` text,
	`author_name` text,
	`verified` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`approved` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reviews_product_idx` ON `reviews` (`product_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_external_idx` ON `reviews` (`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `search_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`query` text NOT NULL,
	`normalized` text,
	`outcome` text NOT NULL,
	`redirect_to` text,
	`result_count` integer,
	`country` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `search_log_created_idx` ON `search_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `addresses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`first_name` text,
	`last_name` text,
	`company` text,
	`line1` text NOT NULL,
	`line2` text,
	`city` text NOT NULL,
	`region` text NOT NULL,
	`postal_code` text NOT NULL,
	`country` text DEFAULT 'US' NOT NULL,
	`phone` text,
	`is_default_shipping` integer DEFAULT false NOT NULL,
	`is_default_billing` integer DEFAULT false NOT NULL,
	`validated_at` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `addresses_customer_idx` ON `addresses` (`customer_id`);--> statement-breakpoint
CREATE TABLE `customer_appliances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`model_id` integer NOT NULL,
	`nickname` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customer_appliances_customer_idx` ON `customer_appliances` (`customer_id`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`phone` text,
	`company` text,
	`legacy_hash_type` text DEFAULT 'none' NOT NULL,
	`legacy_hash` text,
	`migrated_at` text,
	`newsletter` integer DEFAULT false NOT NULL,
	`sms_opt_in` integer DEFAULT false NOT NULL,
	`is_employee` integer DEFAULT false NOT NULL,
	`is_military` integer DEFAULT false NOT NULL,
	`reminder_months` integer,
	`guest` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_email_idx` ON `customers` (`email`);--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`provider` text NOT NULL,
	`provider_token` text NOT NULL,
	`brand` text,
	`last4` text,
	`exp_month` integer,
	`exp_year` integer,
	`nickname` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payment_methods_customer_idx` ON `payment_methods` (`customer_id`);--> statement-breakpoint
CREATE TABLE `cart_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cart_id` text NOT NULL,
	`product_id` integer NOT NULL,
	`option_id` integer,
	`qty` integer DEFAULT 1 NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`subscription_months` integer,
	`custom_sku` text,
	`custom_description` text,
	`is_reward` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cart_items_cart_idx` ON `cart_items` (`cart_id`);--> statement-breakpoint
CREATE TABLE `carts` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` integer,
	`currency` text DEFAULT 'USD' NOT NULL,
	`promo_codes` text,
	`attribution` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `carts_customer_idx` ON `carts` (`customer_id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`product_id` integer,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`option_label` text,
	`qty` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`subscription_months` integer,
	`custom_sku` text,
	`returnable` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`legacy_order_id` integer,
	`customer_id` integer,
	`email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`shipping_cents` integer DEFAULT 0 NOT NULL,
	`tax_cents` integer DEFAULT 0 NOT NULL,
	`donation_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer NOT NULL,
	`billing_address` text NOT NULL,
	`shipping_address` text NOT NULL,
	`shipping_method` text,
	`payment_provider` text,
	`payment_ref` text,
	`promo_codes` text,
	`attribution` text,
	`access_key` text NOT NULL,
	`placed_at` text DEFAULT (current_timestamp) NOT NULL,
	`exported_at` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_number_idx` ON `orders` (`number`);--> statement-breakpoint
CREATE INDEX `orders_customer_idx` ON `orders` (`customer_id`);--> statement-breakpoint
CREATE INDEX `orders_email_idx` ON `orders` (`email`);--> statement-breakpoint
CREATE INDEX `orders_placed_idx` ON `orders` (`placed_at`);--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`carrier` text,
	`tracking_number` text,
	`shipped_at` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shipments_order_idx` ON `shipments` (`order_id`);