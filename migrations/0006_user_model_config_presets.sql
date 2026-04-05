CREATE TABLE `user_model_config_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`configs_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_model_config_presets_user_idx` ON `user_model_config_presets` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_model_config_presets_user_name_idx` ON `user_model_config_presets` (`user_id`, `name`);
