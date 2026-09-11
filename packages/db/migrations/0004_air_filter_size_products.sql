CREATE TABLE `air_filter_size_products` (
	`id` integer PRIMARY KEY NOT NULL,
	`size_key` text NOT NULL,
	`product_id` integer NOT NULL,
	`option_id` integer,
	`merv` text,
	`brand` text,
	`active` integer DEFAULT true NOT NULL,
	`row` integer DEFAULT 0 NOT NULL,
	`col` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `air_filter_size_products_size_idx` ON `air_filter_size_products` (`size_key`);--> statement-breakpoint
CREATE INDEX `air_filter_size_products_product_idx` ON `air_filter_size_products` (`product_id`);