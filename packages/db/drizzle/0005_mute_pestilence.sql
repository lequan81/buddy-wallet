CREATE TABLE `file_metadata` (
	`id` text(24) PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`storage_path` text NOT NULL,
	`uploaded_by_id` text(24) NOT NULL,
	`file_type` text NOT NULL,
	`related_debt_id` text(24),
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by_id` text(24),
	`reviewed_at` integer,
	`rejection_reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`related_debt_id`) REFERENCES `debts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text(24) PRIMARY KEY NOT NULL,
	`user_id` text(24) NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh_key` text NOT NULL,
	`auth_key` text NOT NULL,
	`expiration_time` integer,
	`device_name` text,
	`device_type` text,
	`is_active` integer DEFAULT true NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_push_subscriptions_endpoint` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `idx_push_subscriptions_user_id` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_push_subscriptions_is_active` ON `push_subscriptions` (`is_active`);--> statement-breakpoint
CREATE TABLE `activity_logs` (
	`id` text(24) PRIMARY KEY NOT NULL,
	`user_id` text(24) NOT NULL,
	`action` text NOT NULL,
	`resource` text NOT NULL,
	`resource_id` text(24),
	`changes` text,
	`metadata` text,
	`ip_address` text,
	`user_agent` text,
	`location` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_activity_logs_user_id` ON `activity_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_activity_logs_action` ON `activity_logs` (`action`);--> statement-breakpoint
CREATE INDEX `idx_activity_logs_resource` ON `activity_logs` (`resource`);--> statement-breakpoint
CREATE INDEX `idx_activity_logs_user_created_at` ON `activity_logs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_activity_logs_resource_id` ON `activity_logs` (`resource`,`resource_id`);--> statement-breakpoint
CREATE TABLE `bank_accounts` (
	`id` text(24) PRIMARY KEY NOT NULL,
	`user_id` text(24) NOT NULL,
	`bank_code` text NOT NULL,
	`bank_name` text NOT NULL,
	`bank_bin` text NOT NULL,
	`account_number` text NOT NULL,
	`account_name` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_bank_accounts_user_id` ON `bank_accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `email_verifications` (
	`id` text(24) PRIMARY KEY NOT NULL,
	`user_id` text(24) NOT NULL,
	`email` text NOT NULL,
	`otp_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 5 NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`last_sent_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_email_verifications_user_id` ON `email_verifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_email_verifications_email` ON `email_verifications` (`email`);--> statement-breakpoint
CREATE INDEX `idx_email_verifications_user_email` ON `email_verifications` (`user_id`,`email`,`verified`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` text(24) PRIMARY KEY NOT NULL,
	`user_id` text(24) NOT NULL,
	`access_token` text,
	`access_token_hash` text,
	`access_token_expires_at` integer NOT NULL,
	`refresh_token` text NOT NULL,
	`refresh_token_expires_at` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`revoked_at` integer,
	`revoked_reason` text,
	`device_name` text,
	`device_type` text,
	`location` text,
	`user_agent` text,
	`ip_address` text,
	`last_refreshed_at` integer,
	`last_active_at` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "user_id", "access_token", "access_token_hash", "access_token_expires_at", "refresh_token", "refresh_token_expires_at", "status", "revoked_at", "revoked_reason", "device_name", "device_type", "location", "user_agent", "ip_address", "last_refreshed_at", "last_active_at", "deleted_at", "created_at") SELECT "id", "user_id", "access_token", "access_token_hash", "access_token_expires_at", "refresh_token", "refresh_token_expires_at", "status", "revoked_at", "revoked_reason", "device_name", "device_type", "location", "user_agent", "ip_address", "last_refreshed_at", "last_active_at", "deleted_at", "created_at" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_refresh_token_unique` ON `sessions` (`refresh_token`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user_status` ON `sessions` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_sessions_access_token_hash` ON `sessions` (`access_token_hash`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user_access_hash_status` ON `sessions` (`user_id`,`access_token_hash`,`status`);--> statement-breakpoint
CREATE INDEX `idx_sessions_status_expires` ON `sessions` (`status`,`refresh_token_expires_at`);--> statement-breakpoint
CREATE INDEX `idx_sessions_deleted_at` ON `sessions` (`deleted_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `is_locked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lockout_until` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `failed_login_attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `last_failed_login_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `phone_verified` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `email_notifications_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `push_notifications_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `temporary_password` text;--> statement-breakpoint
ALTER TABLE `users` ADD `temporary_password_expires` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `must_change_password` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `temporary_password_used` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `idx_users_is_active` ON `users` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_users_is_locked` ON `users` (`is_locked`);--> statement-breakpoint
CREATE INDEX `idx_users_locked_until` ON `users` (`is_locked`,`lockout_until`);--> statement-breakpoint
ALTER TABLE `debts` ADD `confirmed_by_creditor` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `debts` ADD `confirmed_by_debtor` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `debts` ADD `needs_confirmation` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `debts` ADD `creditor_confirmed_at` integer;--> statement-breakpoint
ALTER TABLE `debts` ADD `debtor_confirmed_at` integer;--> statement-breakpoint
ALTER TABLE `debts` ADD `has_pending_proof` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `debts` ADD `proof_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `debts` ADD `last_proof_uploaded_at` integer;--> statement-breakpoint
ALTER TABLE `debts` ADD `expires_at` integer;--> statement-breakpoint
ALTER TABLE `debts` ADD `suggested_amount` integer;--> statement-breakpoint
ALTER TABLE `debts` ADD `suggested_description` text;--> statement-breakpoint
ALTER TABLE `debts` ADD `suggested_by_id` text(24) REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `debts` ADD `suggested_at` integer;--> statement-breakpoint
ALTER TABLE `debts` ADD `deleted_at` integer;--> statement-breakpoint
CREATE INDEX `idx_debts_debtor_id` ON `debts` (`debtor_id`);--> statement-breakpoint
CREATE INDEX `idx_debts_creditor_id` ON `debts` (`creditor_id`);--> statement-breakpoint
CREATE INDEX `idx_debts_debtor_phone_status` ON `debts` (`debtor_phone`,`status`);--> statement-breakpoint
CREATE INDEX `idx_debts_creditor_phone_status` ON `debts` (`creditor_phone`,`status`);--> statement-breakpoint
CREATE INDEX `idx_debts_status` ON `debts` (`status`);--> statement-breakpoint
CREATE INDEX `idx_debts_uploaded_by` ON `debts` (`uploaded_by_id`);--> statement-breakpoint
CREATE INDEX `idx_debts_status_created_at` ON `debts` (`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `import_logs` ADD `deleted_at` integer;