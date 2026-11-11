CREATE TABLE `account_owned_projects` (
	`project` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`project`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `flow_users`(`id`) ON UPDATE no action ON DELETE no action
);
