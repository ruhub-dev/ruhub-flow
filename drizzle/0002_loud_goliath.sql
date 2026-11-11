CREATE TABLE `account_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `flow_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `account_sessions_user` ON `account_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `flow_users` (
	`id` text PRIMARY KEY NOT NULL,
	`google_sub` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `flow_users_google_sub_unique` ON `flow_users` (`google_sub`);--> statement-breakpoint
CREATE TABLE `oauth_exchanges` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`challenge` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `flow_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `oauth_pending` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`nonce` text NOT NULL,
	`verifier` text NOT NULL,
	`return_url` text NOT NULL,
	`challenge` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project_accounts` (
	`project` text NOT NULL,
	`user_id` text NOT NULL,
	`access_key` text NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`project`, `user_id`),
	FOREIGN KEY (`project`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `project_accounts_user` ON `project_accounts` (`user_id`);