CREATE TABLE `collaboration_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_key` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
