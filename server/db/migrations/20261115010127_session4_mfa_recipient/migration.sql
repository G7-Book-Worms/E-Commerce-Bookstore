CREATE TABLE `mfa_challenges` (
	`challenge_id` int AUTO_INCREMENT PRIMARY KEY,
	`actor_type` enum('customer','admin') NOT NULL,
	`actor_id` int NOT NULL,
	`code_hash` varchar(64) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`used_at` timestamp,
	`expires_at` timestamp NOT NULL,
	`created` timestamp NOT NULL DEFAULT (now())
);
--> statement-breakpoint
ALTER TABLE `addresses` ADD `recipient_name` varchar(100);--> statement-breakpoint
ALTER TABLE `addresses` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `admin` ADD `mfa_method` enum('email','totp') DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE `admin` ADD `totp_secret` varchar(255);--> statement-breakpoint
ALTER TABLE `admin` ADD `totp_last_step` int;--> statement-breakpoint
ALTER TABLE `users` ADD `mfa_method` enum('none','email','totp') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_secret` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `totp_last_step` int;--> statement-breakpoint
CREATE INDEX `mfa_challenges_actor_idx` ON `mfa_challenges` (`actor_type`,`actor_id`);