CREATE TABLE `search_redirects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`keyword` text NOT NULL,
	`normalized` text NOT NULL,
	`product_id` integer,
	`to_path` text,
	`kind` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `search_redirects_norm_idx` ON `search_redirects` (`normalized`);--> statement-breakpoint
CREATE TABLE `support_articles` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`content_html` text NOT NULL,
	`keywords` text,
	`is_faq` integer DEFAULT false NOT NULL,
	`faq_order` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `support_articles_slug_idx` ON `support_articles` (`slug`);--> statement-breakpoint
CREATE TABLE `support_categories` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`image_url` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`visible` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `support_categories_slug_idx` ON `support_categories` (`slug`);--> statement-breakpoint
CREATE TABLE `support_category_articles` (
	`category_id` integer NOT NULL,
	`article_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`category_id`, `article_id`),
	FOREIGN KEY (`category_id`) REFERENCES `support_categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`article_id`) REFERENCES `support_articles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `support_category_articles_article_idx` ON `support_category_articles` (`article_id`);