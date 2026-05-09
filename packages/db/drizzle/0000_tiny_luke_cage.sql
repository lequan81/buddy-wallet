CREATE TABLE `users` (
	`id` text(24) PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone_number` text NOT NULL,
	`email` text,
	`password` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`permissions` text DEFAULT '[]',
	`is_active` integer DEFAULT true NOT NULL,
	`is_locked` integer DEFAULT false NOT NULL,
	`lockout_until` integer,
	`failed_login_attempts` integer DEFAULT 0 NOT NULL,
	`last_failed_login_at` integer,
	`email_verified` integer DEFAULT false NOT NULL,
	`phone_verified` integer DEFAULT false NOT NULL,
	`session_version` integer DEFAULT 1 NOT NULL,
	`last_password_change_at` integer,
	`email_notifications_enabled` integer DEFAULT false NOT NULL,
	`push_notifications_enabled` integer DEFAULT false NOT NULL,
	`temporary_password` text,
	`temporary_password_expires` integer,
	`must_change_password` integer DEFAULT false NOT NULL,
	`temporary_password_used` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_number_unique` ON `users` (`phone_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `idx_users_is_active` ON `users` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_users_is_locked` ON `users` (`is_locked`);--> statement-breakpoint
CREATE INDEX `idx_users_locked_until` ON `users` (`is_locked`,`lockout_until`);--> statement-breakpoint
CREATE TABLE `debts` (
	`id` text(24) PRIMARY KEY NOT NULL,
	`debtor_phone` text NOT NULL,
	`creditor_phone` text NOT NULL,
	`debtor_id` text(24),
	`creditor_id` text(24),
	`uploaded_by_id` text(24) NOT NULL,
	`amount` integer NOT NULL,
	`currency` text(3) DEFAULT 'USD' NOT NULL,
	`description` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`confirmed_by_creditor` integer DEFAULT false NOT NULL,
	`confirmed_by_debtor` integer DEFAULT false NOT NULL,
	`needs_confirmation` integer DEFAULT true NOT NULL,
	`creditor_confirmed_at` integer,
	`debtor_confirmed_at` integer,
	`has_pending_proof` integer DEFAULT false NOT NULL,
	`proof_count` integer DEFAULT 0 NOT NULL,
	`last_proof_uploaded_at` integer,
	`expires_at` integer,
	`suggested_amount` integer,
	`suggested_description` text,
	`suggested_by_id` text(24),
	`suggested_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`debtor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`creditor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`suggested_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_debts_debtor_id` ON `debts` (`debtor_id`);--> statement-breakpoint
CREATE INDEX `idx_debts_creditor_id` ON `debts` (`creditor_id`);--> statement-breakpoint
CREATE INDEX `idx_debts_debtor_phone_status` ON `debts` (`debtor_phone`,`status`);--> statement-breakpoint
CREATE INDEX `idx_debts_creditor_phone_status` ON `debts` (`creditor_phone`,`status`);--> statement-breakpoint
CREATE INDEX `idx_debts_status` ON `debts` (`status`);--> statement-breakpoint
CREATE INDEX `idx_debts_uploaded_by` ON `debts` (`uploaded_by_id`);--> statement-breakpoint
CREATE INDEX `idx_debts_status_created_at_id` ON `debts` (`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_debts_debtor_created_at_id` ON `debts` (`debtor_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_debts_creditor_created_at_id` ON `debts` (`creditor_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_debts_debtor_status_deleted_created_id` ON `debts` (`debtor_id`,`status`,`deleted_at`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_debts_creditor_status_deleted_created_id` ON `debts` (`creditor_id`,`status`,`deleted_at`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_debts_uploaded_deleted_created_id` ON `debts` (`uploaded_by_id`,`deleted_at`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text(24) PRIMARY KEY NOT NULL,
	`user_id` text(24) NOT NULL,
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
CREATE UNIQUE INDEX `sessions_refresh_token_unique` ON `sessions` (`refresh_token`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user_status` ON `sessions` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_sessions_access_token_hash` ON `sessions` (`access_token_hash`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user_access_hash_status` ON `sessions` (`user_id`,`access_token_hash`,`status`);--> statement-breakpoint
CREATE INDEX `idx_sessions_status_expires` ON `sessions` (`status`,`refresh_token_expires_at`);--> statement-breakpoint
CREATE INDEX `idx_sessions_deleted_at` ON `sessions` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `import_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`file_name` text NOT NULL,
	`file_size` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`preview_log_id` text,
	`total_rows` integer,
	`imported_count` integer,
	`error_count` integer,
	`errors` text,
	`config` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_import_logs_user_id` ON `import_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_import_logs_user_created_at_id` ON `import_logs` (`user_id`,`created_at`,`id`);--> statement-breakpoint
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
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_activity_logs_user_id` ON `activity_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_activity_logs_action` ON `activity_logs` (`action`);--> statement-breakpoint
CREATE INDEX `idx_activity_logs_resource` ON `activity_logs` (`resource`);--> statement-breakpoint
CREATE INDEX `idx_activity_logs_user_created_at` ON `activity_logs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_activity_logs_user_created_at_id` ON `activity_logs` (`user_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_activity_logs_user_action_created_id` ON `activity_logs` (`user_id`,`action`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_activity_logs_resource_created_id` ON `activity_logs` (`resource`,`created_at`,`id`);--> statement-breakpoint
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
CREATE INDEX `idx_bank_accounts_user_default` ON `bank_accounts` (`user_id`,`is_default`);--> statement-breakpoint
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
CREATE TABLE `outbox_events` (
	`id` text(24) PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`aggregate_type` text,
	`aggregate_id` text,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 10 NOT NULL,
	`available_at` integer NOT NULL,
	`processed_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_outbox_status_available_at` ON `outbox_events` (`status`,`available_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_outbox_aggregate` ON `outbox_events` (`aggregate_type`,`aggregate_id`);--> statement-breakpoint
CREATE INDEX `idx_outbox_event_type` ON `outbox_events` (`event_type`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`data` text,
	`is_read` integer DEFAULT false NOT NULL,
	`read_at` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_id` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_notifications_user_read` ON `notifications` (`user_id`,`is_read`);--> statement-breakpoint
CREATE INDEX `idx_notifications_user_created_at` ON `notifications` (`user_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `payment_proofs` (
	`id` text(24) PRIMARY KEY NOT NULL,
	`debt_id` text(24) NOT NULL,
	`uploaded_by_id` text(24) NOT NULL,
	`file_key` text NOT NULL,
	`file_name` text NOT NULL,
	`file_size` integer,
	`mime_type` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by_id` text(24),
	`reviewed_at` integer,
	`rejection_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_payment_proofs_debt_id` ON `payment_proofs` (`debt_id`);--> statement-breakpoint
CREATE INDEX `idx_payment_proofs_uploaded_by` ON `payment_proofs` (`uploaded_by_id`);--> statement-breakpoint
CREATE INDEX `idx_payment_proofs_status` ON `payment_proofs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_payment_proofs_debt_status` ON `payment_proofs` (`debt_id`,`status`);--> statement-breakpoint
CREATE TABLE `debt_status_history` (
	`id` text(24) PRIMARY KEY NOT NULL,
	`debt_id` text(24) NOT NULL,
	`changed_by_id` text(24) NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`reason` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_debt_status_history_debt_id` ON `debt_status_history` (`debt_id`);--> statement-breakpoint
CREATE INDEX `idx_debt_status_history_debt_created` ON `debt_status_history` (`debt_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `debt_suggestions` (
	`id` text(24) PRIMARY KEY NOT NULL,
	`debt_id` text(24) NOT NULL,
	`suggested_by_id` text(24) NOT NULL,
	`amount` integer NOT NULL,
	`description` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`response_note` text,
	`responded_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`suggested_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_debt_suggestions_debt_id` ON `debt_suggestions` (`debt_id`);--> statement-breakpoint
CREATE INDEX `idx_debt_suggestions_suggested_by` ON `debt_suggestions` (`suggested_by_id`);--> statement-breakpoint
CREATE INDEX `idx_debt_suggestions_status` ON `debt_suggestions` (`status`);