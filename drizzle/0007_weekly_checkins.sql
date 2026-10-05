CREATE TABLE `weekly_checkins` (
	`week_start` text PRIMARY KEY NOT NULL,
	`feeling` text,
	`dismissed_at` integer,
	`created_at` integer NOT NULL
);
