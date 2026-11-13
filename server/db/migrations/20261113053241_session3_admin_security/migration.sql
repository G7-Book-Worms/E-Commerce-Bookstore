CREATE TABLE `contact_messages` (
	`message_id` int AUTO_INCREMENT PRIMARY KEY,
	`user_id` int,
	`name` varchar(100) NOT NULL,
	`email` varchar(100) NOT NULL,
	`message` text NOT NULL,
	`status` enum('new','read','replied','archived') NOT NULL DEFAULT 'new',
	`reply` text,
	`replied_by` int,
	`replied_at` timestamp,
	`created` timestamp NOT NULL DEFAULT (now())
);
--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`movement_id` int AUTO_INCREMENT PRIMARY KEY,
	`book_format_id` int NOT NULL,
	`quantity_change` int NOT NULL,
	`stock_after` int NOT NULL,
	`reason` enum('sale','restock','adjustment','cancellation') NOT NULL,
	`note` varchar(255),
	`order_id` int,
	`admin_id` int,
	`created` timestamp NOT NULL DEFAULT (now())
);
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`token_id` int AUTO_INCREMENT PRIMARY KEY,
	`user_id` int NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	`created` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `token_hash_unique` UNIQUE INDEX(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`rate_key` varchar(191) PRIMARY KEY,
	`hits` int NOT NULL DEFAULT 0,
	`window_start` timestamp NOT NULL DEFAULT (now()),
	`locked_until` timestamp
);
--> statement-breakpoint
ALTER TABLE `admin` MODIFY COLUMN `admin_role` enum('admin','employee','manager') DEFAULT 'employee' NOT NULL;--> statement-breakpoint
ALTER TABLE `activity_log` ADD `ip` varchar(45);--> statement-breakpoint
ALTER TABLE `admin` ADD `token_version` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `admin` ADD `must_change_password` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `book_formats` ADD `low_stock_threshold` int DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `token_version` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `must_change_password` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `activity_log_created_idx` ON `activity_log` (`created`);--> statement-breakpoint
CREATE INDEX `activity_log_action_idx` ON `activity_log` (`action`);--> statement-breakpoint
CREATE INDEX `inventory_movements_format_idx` ON `inventory_movements` (`book_format_id`);--> statement-breakpoint
ALTER TABLE `contact_messages` ADD CONSTRAINT `contact_messages_user_id_users_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`);--> statement-breakpoint
ALTER TABLE `contact_messages` ADD CONSTRAINT `contact_messages_replied_by_admin_admin_id_fkey` FOREIGN KEY (`replied_by`) REFERENCES `admin`(`admin_id`);--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_SH3wJznavZ06_fkey` FOREIGN KEY (`book_format_id`) REFERENCES `book_formats`(`book_format_id`) ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_order_id_orders_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`);--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_admin_id_admin_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admin`(`admin_id`);--> statement-breakpoint
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_users_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE;