CREATE TABLE `inbound_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`order_id` integer,
	`error` text,
	`payload` text,
	`remote_ip` text,
	`received_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inbound_events_source_ext_idx` ON `inbound_events` (`source`,`external_id`);--> statement-breakpoint
CREATE INDEX `inbound_events_received_idx` ON `inbound_events` (`received_at`);