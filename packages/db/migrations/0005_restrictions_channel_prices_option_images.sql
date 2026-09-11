CREATE TABLE `channel_prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`option_id` integer,
	`source` text NOT NULL,
	`price_cents` integer NOT NULL,
	`ad_medium` text,
	`price_date` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `channel_prices_product_idx` ON `channel_prices` (`product_id`);--> statement-breakpoint
CREATE INDEX `channel_prices_source_idx` ON `channel_prices` (`source`);--> statement-breakpoint
CREATE TABLE `sale_restrictions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`country` text NOT NULL,
	`region` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sale_restrictions_product_idx` ON `sale_restrictions` (`product_id`);--> statement-breakpoint
CREATE INDEX `sale_restrictions_country_idx` ON `sale_restrictions` (`country`,`region`);--> statement-breakpoint
ALTER TABLE `product_options` ADD `image_url` text;