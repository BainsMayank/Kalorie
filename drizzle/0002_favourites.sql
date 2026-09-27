CREATE TABLE `favourites` (
	`food_source` text NOT NULL,
	`food_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`food_source`, `food_id`)
);
