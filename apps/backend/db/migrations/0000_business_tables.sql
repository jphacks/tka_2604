CREATE TABLE `band_members` (
	`band_id` text NOT NULL,
	`member_id` text NOT NULL,
	PRIMARY KEY(`band_id`, `member_id`),
	FOREIGN KEY (`band_id`) REFERENCES `bands`(`band_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`member_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `band_order` (
	`band_id` text PRIMARY KEY NOT NULL,
	`part_id` text NOT NULL,
	`order` integer NOT NULL,
	FOREIGN KEY (`band_id`) REFERENCES `bands`(`band_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`part_id`) REFERENCES `parts`(`part_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "band_order_order" CHECK(typeof("band_order"."order") = 'integer' and "band_order"."order" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `band_order_part_order` ON `band_order` (`part_id`,`order`);--> statement-breakpoint
CREATE TABLE `bands` (
	`band_id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`band_name` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`event_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `constraints` (
	`constraint_id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`constraint_json` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`event_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "constraints_valid_json" CHECK(json_valid("constraints"."constraint_json")),
	CONSTRAINT "constraints_identity" CHECK(json_extract("constraints"."constraint_json", '$.constraint_id') is "constraints"."constraint_id" and json_extract("constraints"."constraint_json", '$.event_id') is "constraints"."event_id")
);
--> statement-breakpoint
CREATE TABLE `events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`created_user_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'planning' NOT NULL,
	`date` text,
	`venue` text,
	`description` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`created_user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "events_status" CHECK("events"."status" in ('planning', 'adjusting', 'confirmed')),
	CONSTRAINT "events_is_deleted" CHECK("events"."is_deleted" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE `members` (
	`member_id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`member_name` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`event_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `parts` (
	`part_id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`comment` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`event_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "parts_sort_order" CHECK(typeof("parts"."sort_order") = 'integer' and "parts"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `parts_event_sort_order` ON `parts` (`event_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `users` (
	`user_id` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL
);
