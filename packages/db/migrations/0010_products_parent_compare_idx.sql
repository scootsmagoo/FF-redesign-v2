CREATE INDEX `products_parent_idx` ON `products` (`parent_product_id`);--> statement-breakpoint
CREATE INDEX `products_compare_to_idx` ON `products` (`compare_to_id`);
