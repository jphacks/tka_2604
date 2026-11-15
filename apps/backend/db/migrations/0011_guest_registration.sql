ALTER TABLE `users` ADD `login_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `is_registered` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_login_id_unique` ON `users` (`login_id`);