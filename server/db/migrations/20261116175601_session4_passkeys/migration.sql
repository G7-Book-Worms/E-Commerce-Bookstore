CREATE TABLE `passkeys` (
	`passkey_id` int AUTO_INCREMENT PRIMARY KEY,
	`actor_type` enum('customer','admin') NOT NULL,
	`actor_id` int NOT NULL,
	`credential_id` varchar(512) NOT NULL,
	`public_key` text NOT NULL,
	`sign_count` int NOT NULL DEFAULT 0,
	`transports` varchar(191),
	`name` varchar(64) NOT NULL,
	`backed_up` boolean NOT NULL DEFAULT false,
	`last_used_at` timestamp,
	`created` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `passkeys_credential_id_unique` UNIQUE INDEX(`credential_id`)
);
--> statement-breakpoint
CREATE INDEX `passkeys_actor_idx` ON `passkeys` (`actor_type`,`actor_id`);