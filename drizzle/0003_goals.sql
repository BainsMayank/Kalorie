CREATE TABLE `limit_alerts` (
	`day` text NOT NULL,
	`alert` text NOT NULL,
	`fired_at` integer NOT NULL,
	`dismissed_at` integer,
	PRIMARY KEY(`day`, `alert`)
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`sex` text,
	`birth_year` integer,
	`height_cm` real,
	`activity` text,
	`goal` text,
	`pace_kg_week` real,
	`onboarded_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `targets` (
	`id` text PRIMARY KEY NOT NULL,
	`effective_from` text NOT NULL,
	`kcal` real,
	`protein_g` real,
	`carb_g` real,
	`fat_g` real,
	`fibre_g` real,
	`sodium_mg_limit` real NOT NULL,
	`sugar_g_limit` real NOT NULL,
	`sat_fat_g_limit` real NOT NULL,
	`fat_g_limit` real NOT NULL,
	`is_custom` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `targets_effective_from_unique` ON `targets` (`effective_from`);--> statement-breakpoint
CREATE TABLE `weights` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`weight_kg` real NOT NULL,
	`logged_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `weights_day_idx` ON `weights` (`day`,`deleted_at`);