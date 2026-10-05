ALTER TABLE `custom_foods` ADD `share_with_group` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `custom_foods` ADD `shared_at` integer;--> statement-breakpoint
ALTER TABLE `custom_foods` ADD `added_by` text;