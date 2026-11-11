CREATE TABLE `presence` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`name` text NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`editor` text NOT NULL,
	`viewer` text NOT NULL,
	`document` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`document` text NOT NULL,
	`revision` integer NOT NULL,
	`author` text NOT NULL,
	`created` text NOT NULL
);
