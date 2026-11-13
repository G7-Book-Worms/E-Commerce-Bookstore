CREATE TABLE `book_formats` (
	`book_format_id` int AUTO_INCREMENT PRIMARY KEY,
	`book_id` int NOT NULL,
	`format` enum('hardcover','paperback') NOT NULL,
	`price_cents` int NOT NULL,
	`sale_price_cents` int,
	`stock` int NOT NULL DEFAULT 0,
	CONSTRAINT `book_formats_book_format_unique` UNIQUE INDEX(`book_id`,`format`)
);
--> statement-breakpoint
CREATE TABLE `book_tags` (
	`book_tag_id` int AUTO_INCREMENT PRIMARY KEY,
	`book_id` int NOT NULL,
	`tag` varchar(50) NOT NULL,
	CONSTRAINT `book_tags_book_tag_unique` UNIQUE INDEX(`book_id`,`tag`)
);
--> statement-breakpoint
CREATE TABLE `discount_codes` (
	`discount_code_id` int AUTO_INCREMENT PRIMARY KEY,
	`code` varchar(32) NOT NULL,
	`percent_off` int,
	`amount_off_cents` int,
	`starts_at` timestamp,
	`ends_at` timestamp,
	`is_active` boolean NOT NULL DEFAULT true,
	`max_uses` int,
	`times_used` int NOT NULL DEFAULT 0,
	`created` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `code_unique` UNIQUE INDEX(`code`)
);
--> statement-breakpoint
ALTER TABLE `books` MODIFY COLUMN `description` text DEFAULT ('') NOT NULL;--> statement-breakpoint
ALTER TABLE `admin` ADD `employee_id` varchar(20);--> statement-breakpoint
ALTER TABLE `books` ADD `rating_avg` decimal(2,1) DEFAULT (0.0) NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `rating_count` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `cart_items` ADD `format` enum('hardcover','paperback') DEFAULT 'paperback' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `format` enum('hardcover','paperback') DEFAULT 'paperback' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `subtotal_cents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_cents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `tax_cents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_code_id` int;--> statement-breakpoint
ALTER TABLE `payments` ADD `card_brand` varchar(20);--> statement-breakpoint
ALTER TABLE `payments` ADD `card_last4` varchar(4);--> statement-breakpoint
ALTER TABLE `users` ADD `is_active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `employee_id_unique` ON `admin` (`employee_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_session_id_unique` ON `payments` (`stripe_session_id`);--> statement-breakpoint
CREATE INDEX `book_tags_tag_idx` ON `book_tags` (`tag`);--> statement-breakpoint
CREATE UNIQUE INDEX `cart_items_cart_book_format_unique` ON `cart_items` (`cart_id`,`book_id`,`format`);--> statement-breakpoint
ALTER TABLE `book_formats` ADD CONSTRAINT `book_formats_book_id_books_book_id_fkey` FOREIGN KEY (`book_id`) REFERENCES `books`(`book_id`) ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE `book_tags` ADD CONSTRAINT `book_tags_book_id_books_book_id_fkey` FOREIGN KEY (`book_id`) REFERENCES `books`(`book_id`) ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_discount_code_id_discount_codes_discount_code_id_fkey` FOREIGN KEY (`discount_code_id`) REFERENCES `discount_codes`(`discount_code_id`);