ALTER TABLE `ai_runs` ADD `case_id` text DEFAULT 'openair' NOT NULL;--> statement-breakpoint
CREATE INDEX `ai_runs_case_created_idx` ON `ai_runs` (`case_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `collaboration_events` ADD `case_id` text DEFAULT 'openair' NOT NULL;--> statement-breakpoint
CREATE INDEX `collaboration_events_case_id_idx` ON `collaboration_events` (`case_id`,`id`);--> statement-breakpoint
ALTER TABLE `messages` ADD `case_id` text DEFAULT 'openair' NOT NULL;--> statement-breakpoint
CREATE INDEX `messages_case_id_idx` ON `messages` (`case_id`,`id`);