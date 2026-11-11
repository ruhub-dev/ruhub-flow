CREATE TABLE `auth_throttle` (
	`key` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_throttle_expires` ON `auth_throttle` (`expires`);--> statement-breakpoint
CREATE TABLE `local_credentials` (
	`user_id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`recovery_hash` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `flow_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `local_credentials_username_unique` ON `local_credentials` (`username`);--> statement-breakpoint
ALTER TABLE `account_sessions` ADD `credential_version` integer DEFAULT 0 NOT NULL;