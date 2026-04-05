CREATE TABLE `model_config_global_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL DEFAULT 0,
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
INSERT INTO `model_config_global_revision` (`id`, `revision`) VALUES ('global', 0);
