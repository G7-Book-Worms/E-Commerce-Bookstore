CREATE TABLE `activity_log` (
	`activity_id` int AUTO_INCREMENT PRIMARY KEY,
	`actor_type` enum('customer','admin','system') NOT NULL,
	`actor_id` int,
	`action` varchar(100) NOT NULL,
	`details` json,
	`created` timestamp NOT NULL DEFAULT (now())
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `addresses` ADD `is_default` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `cover_image_url` varchar(500);--> statement-breakpoint
ALTER TABLE `orders` ADD `tracking_number` varchar(100);--> statement-breakpoint
ALTER TABLE `orders` ADD `created` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `stripe_session_id` varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX `slug_unique` ON `book_categories` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `isbn_unique` ON `books` (`isbn`);