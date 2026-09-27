CREATE TABLE `log_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`logged_at` integer NOT NULL,
	`slot_id` text NOT NULL,
	`food_source` text NOT NULL,
	`food_id` text,
	`name` text NOT NULL,
	`qty` real,
	`unit` text,
	`grams` real,
	`oil_level` integer DEFAULT 0 NOT NULL,
	`quick_kcal` real,
	`quick_protein_g` real,
	`quick_carb_g` real,
	`quick_fat_g` real,
	`note` text,
	`batch_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `log_entries_day_idx` ON `log_entries` (`day`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `log_entries_food_idx` ON `log_entries` (`food_source`,`food_id`);--> statement-breakpoint
CREATE INDEX `log_entries_slot_idx` ON `log_entries` (`slot_id`,`logged_at`);--> statement-breakpoint
CREATE TABLE `meal_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`position` integer NOT NULL,
	`start_min` integer NOT NULL,
	`end_min` integer NOT NULL,
	`is_hidden` integer DEFAULT false NOT NULL,
	`is_builtin` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
