CREATE TABLE `admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `admin_sessions_admin_idx` ON `admin_sessions` (`admin_id`);--> statement-breakpoint
CREATE INDEX `admin_sessions_expires_idx` ON `admin_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `admins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`password_hash` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`must_change_password` integer DEFAULT false NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`last_login_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_email_idx` ON `admins` (`email`);--> statement-breakpoint
ALTER TABLE `auth_user` DROP COLUMN `role`;