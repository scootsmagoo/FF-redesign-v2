CREATE TABLE `payment_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_number` text,
	`customer_id` integer,
	`email` text,
	`kind` text NOT NULL,
	`provider` text NOT NULL,
	`method` text,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`ok` integer NOT NULL,
	`transaction_id` text,
	`message` text,
	`ip_address` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `payment_logs_created_idx` ON `payment_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `payment_logs_order_idx` ON `payment_logs` (`order_number`);--> statement-breakpoint
CREATE INDEX `payment_logs_customer_idx` ON `payment_logs` (`customer_id`);
