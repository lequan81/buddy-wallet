ALTER TABLE `users` ADD `session_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `last_password_change_at` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `revoked_at` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `revoked_reason` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `device_name` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `device_type` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `location` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `last_active_at` integer;--> statement-breakpoint
ALTER TABLE `import_logs` ADD `preview_log_id` text;