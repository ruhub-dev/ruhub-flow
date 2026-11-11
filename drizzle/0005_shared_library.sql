CREATE TABLE `flow_library` (
  `id` text PRIMARY KEY NOT NULL,
  `document` text,
  `version` integer DEFAULT 1 NOT NULL,
  `updated` text NOT NULL,
  `updated_by` text NOT NULL
);
