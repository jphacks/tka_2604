PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`created_user_id` text NOT NULL,
	`title` text NOT NULL,
	`date` text,
	`venue` text,
	`description` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`created_user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "events_is_deleted" CHECK("__new_events"."is_deleted" in (0, 1))
);
--> statement-breakpoint
INSERT INTO `__new_events`("event_id", "created_user_id", "title", "date", "venue", "description", "created_at", "updated_at", "is_deleted") SELECT "event_id", "created_user_id", "title", "date", "venue", "description", "created_at", "updated_at", "is_deleted" FROM `events`;--> statement-breakpoint
DROP TABLE `events`;--> statement-breakpoint
ALTER TABLE `__new_events` RENAME TO `events`;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;