CREATE TABLE `water_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`logged_at` integer NOT NULL,
	`ml` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `water_logs_day_idx` ON `water_logs` (`day`,`deleted_at`);