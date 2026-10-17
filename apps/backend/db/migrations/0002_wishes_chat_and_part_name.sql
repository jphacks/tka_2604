ALTER TABLE `parts` RENAME COLUMN "comment" TO "part_name";--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`message_id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`seq` integer NOT NULL,
	`role` text NOT NULL,
	`text` text NOT NULL,
	`reply_to_message_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`event_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reply_to_message_id`) REFERENCES `chat_messages`(`message_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chat_messages_seq" CHECK(typeof("chat_messages"."seq") = 'integer' and "chat_messages"."seq" >= 0),
	CONSTRAINT "chat_messages_role" CHECK("chat_messages"."role" in ('user', 'assistant')),
	CONSTRAINT "chat_messages_reply_role" CHECK(("chat_messages"."role" = 'user' and "chat_messages"."reply_to_message_id" is null) or ("chat_messages"."role" = 'assistant' and "chat_messages"."reply_to_message_id" is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_messages_event_seq` ON `chat_messages` (`event_id`,`seq`);--> statement-breakpoint
CREATE UNIQUE INDEX `chat_messages_reply` ON `chat_messages` (`reply_to_message_id`);--> statement-breakpoint
ALTER TABLE `bands` ADD `request_text` text;--> statement-breakpoint
ALTER TABLE `bands` ADD `request_status` text;--> statement-breakpoint
ALTER TABLE `constraints` ADD `source_band_id` text REFERENCES bands(band_id);