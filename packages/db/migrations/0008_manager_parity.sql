CREATE TABLE `admin_failed_logins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`method` text DEFAULT 'form' NOT NULL,
	`ip_address` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_failed_logins_created_idx` ON `admin_failed_logins` (`created_at`);--> statement-breakpoint
CREATE TABLE `admin_password_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`admin_id` integer NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `admin_password_history_admin_idx` ON `admin_password_history` (`admin_id`);--> statement-breakpoint
CREATE TABLE `admin_roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`permissions` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_roles_name_idx` ON `admin_roles` (`name`);--> statement-breakpoint
CREATE TABLE `affiliate_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`affiliate_id` integer NOT NULL,
	`kind` text NOT NULL,
	`item_id` integer NOT NULL,
	FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `affiliate_items_affiliate_idx` ON `affiliate_items` (`affiliate_id`);--> statement-breakpoint
CREATE TABLE `affiliates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`content_html` text,
	`image_url` text,
	`discount_percent` real DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `affiliates_slug_idx` ON `affiliates` (`slug`);--> statement-breakpoint
CREATE TABLE `backorder_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`option_id` integer,
	`email` text NOT NULL,
	`customer_id` integer,
	`notified_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `backorder_requests_product_idx` ON `backorder_requests` (`product_id`);--> statement-breakpoint
CREATE INDEX `backorder_requests_open_idx` ON `backorder_requests` (`notified_at`);--> statement-breakpoint
CREATE TABLE `customer_merges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`to_customer_id` integer NOT NULL,
	`from_customer_id` integer,
	`order_id` integer NOT NULL,
	`admin_email` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customer_merges_to_idx` ON `customer_merges` (`to_customer_id`);--> statement-breakpoint
CREATE TABLE `newsletters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject` text NOT NULL,
	`body_html` text NOT NULL,
	`segment` text DEFAULT 'optin' NOT NULL,
	`paid_only` integer DEFAULT false NOT NULL,
	`recipient_count` integer,
	`sent_count` integer DEFAULT 0 NOT NULL,
	`bookmark` text,
	`sent_at` text,
	`created_by` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_credits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`customer_id` integer,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`method` text DEFAULT 'original' NOT NULL,
	`reason` text NOT NULL,
	`note` text,
	`status` text DEFAULT 'success' NOT NULL,
	`provider_ref` text,
	`response` text,
	`admin_email` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_credits_order_idx` ON `order_credits` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_credits_customer_idx` ON `order_credits` (`customer_id`);--> statement-breakpoint
CREATE TABLE `product_compare_specs` (
	`product_id` integer PRIMARY KEY NOT NULL,
	`compare_type` integer DEFAULT 0 NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `product_price_changelog` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`prev_price_cents` integer,
	`new_price_cents` integer,
	`tier_changes` text,
	`admin_email` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `product_price_changelog_product_idx` ON `product_price_changelog` (`product_id`);--> statement-breakpoint
CREATE TABLE `return_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`return_id` integer NOT NULL,
	`product_id` integer,
	`sku` text NOT NULL,
	`option_label` text,
	`qty` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`reason` text,
	`refund_only` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`return_id`) REFERENCES `returns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `return_items_return_idx` ON `return_items` (`return_id`);--> statement-breakpoint
CREATE TABLE `returns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`customer_id` integer,
	`status` text DEFAULT 'requested' NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`fee_cents` integer DEFAULT 0 NOT NULL,
	`tax_cents` integer DEFAULT 0 NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`comment` text,
	`label_tracking` text,
	`refunded_at` text,
	`admin_email` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `returns_order_idx` ON `returns` (`order_id`);--> statement-breakpoint
CREATE INDEX `returns_status_idx` ON `returns` (`status`);--> statement-breakpoint
CREATE TABLE `sales_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_codes_code_idx` ON `sales_codes` (`code`);--> statement-breakpoint
ALTER TABLE `products` ADD `meta_keywords` text;--> statement-breakpoint
ALTER TABLE `products` ADD `map_cents` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `cost_cents` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `dim_fee_cents` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `discounted_shipping` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `free_product` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `gift_with_purchase_id` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `og_price_cents` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `compare_sort_order` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `include_in_feed` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `feed_override` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `nav_item_no` text;--> statement-breakpoint
ALTER TABLE `products` ADD `actual_inventory` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `google_category` text;--> statement-breakpoint
ALTER TABLE `products` ADD `comparison_text` text;--> statement-breakpoint
ALTER TABLE `products` ADD `show_unaffiliated` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` ADD `author_location` text;--> statement-breakpoint
ALTER TABLE `reviews` ADD `author_email` text;--> statement-breakpoint
ALTER TABLE `reviews` ADD `ip_address` text;--> statement-breakpoint
ALTER TABLE `support_categories` ADD `include_in_chat` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `tax_exempt` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `tax_exempt_until` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `cancel_reason` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `cancelled_at` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `private_notes` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `public_notes` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `sales_code` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `ip_address` text;--> statement-breakpoint
ALTER TABLE `promotions` ADD `single_use` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `promotions` ADD `multiply_by_qty` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `promotions` ADD `usable_every_days` integer;--> statement-breakpoint
ALTER TABLE `promotions` ADD `landing_kind` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `promotions` ADD `content_html` text;--> statement-breakpoint
ALTER TABLE `promotions` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `promotions` ADD `product_text` text;--> statement-breakpoint
ALTER TABLE `promotions` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `promotions` ADD `locked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `promotions` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `promotions` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `admins` ADD `role_id` integer;--> statement-breakpoint
ALTER TABLE `admins` ADD `permissions` text;--> statement-breakpoint
ALTER TABLE `admins` ADD `sales_code` text;--> statement-breakpoint
ALTER TABLE `admins` ADD `password_changed_at` text;