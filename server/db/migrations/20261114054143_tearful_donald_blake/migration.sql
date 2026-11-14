CREATE TABLE `staff_notifications` (
	`notification_id` int AUTO_INCREMENT PRIMARY KEY,
	`kind` enum('low_stock','sold_out') NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` text,
	`subject_type` enum('book','order'),
	`subject_id` int,
	`read_at` timestamp,
	`created` timestamp NOT NULL DEFAULT (now())
);
--> statement-breakpoint
CREATE TABLE `ticket_messages` (
	`ticket_message_id` int AUTO_INCREMENT PRIMARY KEY,
	`ticket_id` int NOT NULL,
	`direction` enum('in','out') NOT NULL,
	`from_email` varchar(100) NOT NULL,
	`body` text NOT NULL,
	`message_id` varchar(255),
	`in_reply_to` varchar(255),
	`staff_id` int,
	`created` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `message_id_unique` UNIQUE INDEX(`message_id`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`ticket_id` int AUTO_INCREMENT PRIMARY KEY,
	`number` int NOT NULL,
	`subject` varchar(200) NOT NULL,
	`user_id` int,
	`customer_name` varchar(100) NOT NULL,
	`customer_email` varchar(100) NOT NULL,
	`status` enum('open','pending','resolved','closed') NOT NULL DEFAULT 'open',
	`assigned_to` int,
	`created` timestamp NOT NULL DEFAULT (now()),
	`updated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `number_unique` UNIQUE INDEX(`number`)
);
--> statement-breakpoint
ALTER TABLE `admin` MODIFY COLUMN `admin_role` enum('owner','admin','employee','manager') DEFAULT 'employee' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `carrier` enum('ups','fedex','usps','dhl');--> statement-breakpoint
ALTER TABLE `orders` ADD `guest_email` varchar(100);--> statement-breakpoint
CREATE INDEX `staff_notifications_read_idx` ON `staff_notifications` (`read_at`);--> statement-breakpoint
CREATE INDEX `ticket_messages_ticket_idx` ON `ticket_messages` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `tickets_status_idx` ON `tickets` (`status`);--> statement-breakpoint
CREATE INDEX `tickets_email_idx` ON `tickets` (`customer_email`);--> statement-breakpoint
ALTER TABLE `ticket_messages` ADD CONSTRAINT `ticket_messages_ticket_id_tickets_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`ticket_id`) ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE `ticket_messages` ADD CONSTRAINT `ticket_messages_staff_id_admin_admin_id_fkey` FOREIGN KEY (`staff_id`) REFERENCES `admin`(`admin_id`);--> statement-breakpoint
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_user_id_users_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`);--> statement-breakpoint
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_assigned_to_admin_admin_id_fkey` FOREIGN KEY (`assigned_to`) REFERENCES `admin`(`admin_id`);