CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`day` text NOT NULL,
	`title` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_owner_day` ON `tasks` (`owner_id`,`day`);--> statement-breakpoint
CREATE INDEX `idx_tasks_owner_open` ON `tasks` (`owner_id`,`completed`,`day`);