CREATE TABLE `addresses` (
	`address_id` int AUTO_INCREMENT PRIMARY KEY,
	`user_id` int,
	`street` varchar(100) NOT NULL,
	`city` varchar(100) NOT NULL,
	`state` varchar(100) NOT NULL,
	`zip` varchar(20) NOT NULL,
	`country` varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin` (
	`admin_id` int AUTO_INCREMENT PRIMARY KEY,
	`first_name` varchar(50) NOT NULL,
	`last_name` varchar(50) NOT NULL,
	`email` varchar(100) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`admin_role` enum('admin','employee','manager') NOT NULL DEFAULT 'manager',
	`is_active` boolean NOT NULL DEFAULT true,
	`last_login` timestamp,
	`created` timestamp NOT NULL DEFAULT (now()),
	`updated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_unique` UNIQUE INDEX(`email`)
);
--> statement-breakpoint
CREATE TABLE `book_categories` (
	`category_id` int AUTO_INCREMENT PRIMARY KEY,
	`name` varchar(50) NOT NULL,
	`slug` varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `books` (
	`book_id` int AUTO_INCREMENT PRIMARY KEY,
	`category_id` int,
	`isbn` varchar(17) NOT NULL,
	`author` varchar(100) NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text NOT NULL,
	`stock` int NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `cart_items` (
	`cart_item_id` int AUTO_INCREMENT PRIMARY KEY,
	`cart_id` int NOT NULL,
	`book_id` int NOT NULL,
	`quantity` int NOT NULL
);
--> statement-breakpoint
CREATE TABLE `carts` (
	`cart_id` int AUTO_INCREMENT PRIMARY KEY,
	`user_id` int NOT NULL,
	`updated` timestamp NOT NULL DEFAULT (now())
);
--> statement-breakpoint
CREATE TABLE `events` (
	`event_id` int AUTO_INCREMENT PRIMARY KEY,
	`start_date` date NOT NULL,
	`end_date` date NOT NULL,
	`promotional_code` varchar(8)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`order_item_id` int AUTO_INCREMENT PRIMARY KEY,
	`order_id` int NOT NULL,
	`book_id` int NOT NULL,
	`quantity` int NOT NULL,
	`unit_price` decimal(10,2) NOT NULL,
	`unit_total` decimal(10,2) GENERATED ALWAYS AS (`quantity` * `unit_price`) STORED
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`order_id` int AUTO_INCREMENT PRIMARY KEY,
	`user_id` int,
	`status` enum('pending','transit','arrived','cancelled') NOT NULL DEFAULT 'pending',
	`shipping_address_id` int NOT NULL,
	`note` varchar(500),
	`price_cents` int NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`payment_id` int AUTO_INCREMENT PRIMARY KEY,
	`order_id` int NOT NULL,
	`card_provider` varchar(50) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`status` enum('pending','processing','completed','failed','cancelled','refunded','chargeback') NOT NULL DEFAULT 'pending',
	`created` timestamp NOT NULL DEFAULT (now())
);
--> statement-breakpoint
CREATE TABLE `users` (
	`user_id` int AUTO_INCREMENT PRIMARY KEY,
	`first_name` varchar(50) NOT NULL,
	`last_name` varchar(50) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(100) NOT NULL,
	`created` timestamp NOT NULL DEFAULT (now()),
	`updated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`password_hash` varchar(255) NOT NULL,
	CONSTRAINT `phone_unique` UNIQUE INDEX(`phone`),
	CONSTRAINT `email_unique` UNIQUE INDEX(`email`)
);
--> statement-breakpoint
ALTER TABLE `addresses` ADD CONSTRAINT `addresses_user_id_users_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`);--> statement-breakpoint
ALTER TABLE `books` ADD CONSTRAINT `books_category_id_book_categories_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `book_categories`(`category_id`);--> statement-breakpoint
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_cart_id_carts_cart_id_fkey` FOREIGN KEY (`cart_id`) REFERENCES `carts`(`cart_id`) ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_book_id_books_book_id_fkey` FOREIGN KEY (`book_id`) REFERENCES `books`(`book_id`);--> statement-breakpoint
ALTER TABLE `carts` ADD CONSTRAINT `carts_user_id_users_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`);--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_orders_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`);--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_book_id_books_book_id_fkey` FOREIGN KEY (`book_id`) REFERENCES `books`(`book_id`);--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_users_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`);--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_shipping_address_id_addresses_address_id_fkey` FOREIGN KEY (`shipping_address_id`) REFERENCES `addresses`(`address_id`);--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_order_id_orders_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`);