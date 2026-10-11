CREATE TABLE `ai_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_key` text NOT NULL,
	`prompt` text NOT NULL,
	`result` text,
	`revision` integer NOT NULL,
	`model` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
