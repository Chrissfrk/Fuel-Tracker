CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`created_by` text NOT NULL,
	`rev` integer NOT NULL,
	`car_id` text,
	`monthly_amount` real NOT NULL
);
--> statement-breakpoint
CREATE INDEX `budgets_rev_idx` ON `budgets` (`rev`);--> statement-breakpoint
CREATE TABLE `car_access` (
	`car_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`car_id`, `user_id`),
	FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `cars` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`created_by` text NOT NULL,
	`rev` integer NOT NULL,
	`name` text NOT NULL,
	`make` text,
	`model` text,
	`plate` text,
	`fuel_type` text NOT NULL,
	`tank_size_liters` real NOT NULL,
	`start_odometer_km` real NOT NULL,
	`start_date` text NOT NULL,
	`color` text,
	`archived` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cars_rev_idx` ON `cars` (`rev`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`created_by` text NOT NULL,
	`rev` integer NOT NULL,
	`car_id` text NOT NULL,
	`date` text NOT NULL,
	`category` text NOT NULL,
	`amount` real NOT NULL,
	`odometer_km` real,
	`note` text,
	`receipt_photo_id` text
);
--> statement-breakpoint
CREATE INDEX `expenses_rev_idx` ON `expenses` (`rev`);--> statement-breakpoint
CREATE INDEX `expenses_car_idx` ON `expenses` (`car_id`,`date`);--> statement-breakpoint
CREATE TABLE `fillups` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`created_by` text NOT NULL,
	`rev` integer NOT NULL,
	`car_id` text NOT NULL,
	`date` text NOT NULL,
	`trip_km` real NOT NULL,
	`liters` real NOT NULL,
	`total_cost` real NOT NULL,
	`full_tank` integer DEFAULT true NOT NULL,
	`missed_previous` integer DEFAULT false NOT NULL,
	`fuel_type` text,
	`station` text,
	`note` text,
	`receipt_photo_id` text
);
--> statement-breakpoint
CREATE INDEX `fillups_rev_idx` ON `fillups` (`rev`);--> statement-breakpoint
CREATE INDEX `fillups_car_idx` ON `fillups` (`car_id`,`date`);--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `odometer_readings` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`created_by` text NOT NULL,
	`rev` integer NOT NULL,
	`car_id` text NOT NULL,
	`date` text NOT NULL,
	`odometer_km` real NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `odometer_rev_idx` ON `odometer_readings` (`rev`);--> statement-breakpoint
CREATE INDEX `odometer_car_idx` ON `odometer_readings` (`car_id`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`created_by` text NOT NULL,
	`rev` integer NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`created_by` text NOT NULL,
	`rev` integer NOT NULL,
	`car_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`every_km` integer,
	`every_months` integer,
	`last_done_km` real,
	`last_done_date` text,
	`due_date` text
);
--> statement-breakpoint
CREATE INDEX `reminders_rev_idx` ON `reminders` (`rev`);--> statement-breakpoint
CREATE INDEX `reminders_car_idx` ON `reminders` (`car_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`default_car_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`created_by` text NOT NULL,
	`rev` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);