-- Consolidated migration: All tables from current schema
-- This migration creates all tables from scratch for fresh installs.
-- Date: 2026-05-07

-- ============================================
-- USERS
-- ============================================
CREATE TABLE `users` (
	`id` text(24) PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone_number` text NOT NULL,
	`email` text,
	`password` text NOT NULL,
	`role` text NOT NULL DEFAULT 'user',
	`permissions` text DEFAULT '[]',
	`is_active` integer NOT NULL DEFAULT true,
	`is_locked` integer NOT NULL DEFAULT false,
	`lockout_until` integer,
	`failed_login_attempts` integer NOT NULL DEFAULT 0,
	`last_failed_login_at` integer,
	`email_verified` integer NOT NULL DEFAULT false,
	`phone_verified` integer NOT NULL DEFAULT false,
	`session_version` integer NOT NULL DEFAULT 1,
	`last_password_change_at` integer,
	`email_notifications_enabled` integer NOT NULL DEFAULT false,
	`push_notifications_enabled` integer NOT NULL DEFAULT false,
	`temporary_password` text,
	`temporary_password_expires` integer,
	`must_change_password` integer NOT NULL DEFAULT false,
	`temporary_password_used` integer NOT NULL DEFAULT false,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_number_unique` ON `users` (`phone_number`);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);
--> statement-breakpoint
CREATE INDEX `idx_users_is_active` ON `users` (`is_active`);
--> statement-breakpoint
CREATE INDEX `idx_users_is_locked` ON `users` (`is_locked`);
--> statement-breakpoint
CREATE INDEX `idx_users_locked_until` ON `users` (`is_locked`, `lockout_until`);
--> statement-breakpoint

-- ============================================
-- SESSIONS
-- ============================================
CREATE TABLE `sessions` (
	`id` text(24) PRIMARY KEY NOT NULL,
	`user_id` text(24) NOT NULL,
	`access_token_hash` text,
	`access_token_expires_at` integer NOT NULL,
	`refresh_token` text NOT NULL,
	`refresh_token_expires_at` integer NOT NULL,
	`status` text NOT NULL DEFAULT 'active',
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
CREATE UNIQUE INDEX `sessions_refresh_token_unique` ON `sessions` (`refresh_token`);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user_status` ON `sessions` (`user_id`, `status`);
--> statement-breakpoint
CREATE INDEX `idx_sessions_access_token_hash` ON `sessions` (`access_token_hash`);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user_access_hash_status` ON `sessions` (`user_id`, `access_token_hash`, `status`);
--> statement-breakpoint
CREATE INDEX `idx_sessions_status_expires` ON `sessions` (`status`, `refresh_token_expires_at`);
--> statement-breakpoint
CREATE INDEX `idx_sessions_deleted_at` ON `sessions` (`deleted_at`);
--> statement-breakpoint

-- ============================================
-- DEBTS
-- ============================================
CREATE TABLE `debts` (
	`id` text(24) PRIMARY KEY NOT NULL,
	`debtor_phone` text NOT NULL,
	`creditor_phone` text NOT NULL,
	`debtor_id` text(24),
	`creditor_id` text(24),
	`uploaded_by_id` text(24) NOT NULL,
	`amount` integer NOT NULL,
	`currency` text(3) NOT NULL DEFAULT 'USD',
	`description` text,
	`status` text NOT NULL DEFAULT 'pending',
	`confirmed_by_creditor` integer NOT NULL DEFAULT false,
	`confirmed_by_debtor` integer NOT NULL DEFAULT false,
	`needs_confirmation` integer NOT NULL DEFAULT true,
	`creditor_confirmed_at` integer,
	`debtor_confirmed_at` integer,
	`has_pending_proof` integer NOT NULL DEFAULT false,
	`proof_count` integer NOT NULL DEFAULT 0,
	`last_proof_uploaded_at` integer,
	`expires_at` integer,
	`suggested_amount` integer,
	`suggested_description` text,
	`suggested_by_id` text(24),
	`suggested_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`debtor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creditor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`suggested_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_debts_debtor_id` ON `debts` (`debtor_id`);
--> statement-breakpoint
CREATE INDEX `idx_debts_creditor_id` ON `debts` (`creditor_id`);
--> statement-breakpoint
CREATE INDEX `idx_debts_debtor_phone_status` ON `debts` (`debtor_phone`, `status`);
--> statement-breakpoint
CREATE INDEX `idx_debts_creditor_phone_status` ON `debts` (`creditor_phone`, `status`);
--> statement-breakpoint
CREATE INDEX `idx_debts_status` ON `debts` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_debts_uploaded_by` ON `debts` (`uploaded_by_id`);
--> statement-breakpoint
CREATE INDEX `idx_debts_status_created_at_id` ON `debts` (`status`, `created_at`, `id`);
--> statement-breakpoint
CREATE INDEX `idx_debts_debtor_created_at_id` ON `debts` (`debtor_id`, `created_at`, `id`);
--> statement-breakpoint
CREATE INDEX `idx_debts_creditor_created_at_id` ON `debts` (`creditor_id`, `created_at`, `id`);
--> statement-breakpoint
CREATE INDEX `idx_debts_debtor_status_deleted_created_id` ON `debts` (`debtor_id`, `status`, `deleted_at`, `created_at`, `id`);
--> statement-breakpoint
CREATE INDEX `idx_debts_creditor_status_deleted_created_id` ON `debts` (`creditor_id`, `status`, `deleted_at`, `created_at`, `id`);
--> statement-breakpoint
CREATE INDEX `idx_debts_uploaded_deleted_created_id` ON `debts` (`uploaded_by_id`, `deleted_at`, `created_at`, `id`);
--> statement-breakpoint

-- ============================================
-- BANK ACCOUNTS
-- ============================================
CREATE TABLE `bank_accounts` (
	`id` text(24) PRIMARY KEY NOT NULL,
	`user_id` text(24) NOT NULL,
	`bank_code` text NOT NULL,
	`bank_name` text NOT NULL,
	`bank_bin` text NOT NULL,
	`account_number` text NOT NULL,
	`account_name` text,
	`is_default` integer NOT NULL DEFAULT false,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_bank_accounts_user_id` ON `bank_accounts` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_bank_accounts_user_default` ON `bank_accounts` (`user_id`, `is_default`);
--> statement-breakpoint

-- ============================================
-- IMPORT LOGS
-- ============================================
CREATE TABLE `import_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`file_name` text NOT NULL,
	`file_size` integer NOT NULL,
	`status` text NOT NULL DEFAULT 'pending',
	`preview_log_id` text,
	`total_rows` integer,
	`imported_count` integer,
	`error_count` integer,
	`errors` text,
	`config` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_import_logs_user_id` ON `import_logs` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_import_logs_user_created_at_id` ON `import_logs` (`user_id`, `created_at`, `id`);
--> statement-breakpoint

-- ============================================
-- PUSH SUBSCRIPTIONS
-- ============================================
CREATE TABLE `push_subscriptions` (
	`id` text(24) PRIMARY KEY NOT NULL,
	`user_id` text(24) NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh_key` text NOT NULL,
	`auth_key` text NOT NULL,
	`expiration_time` integer,
	`device_name` text,
	`device_type` text,
	`is_active` integer NOT NULL DEFAULT true,
	`failed_attempts` integer NOT NULL DEFAULT 0,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
) WITHOUT ROWID;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_push_subscriptions_endpoint` ON `push_subscriptions` (`endpoint`);
--> statement-breakpoint
CREATE INDEX `idx_push_subscriptions_user_id` ON `push_subscriptions` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_push_subscriptions_is_active` ON `push_subscriptions` (`is_active`);
--> statement-breakpoint

-- ============================================
-- ACTIVITY LOGS
-- ============================================
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
CREATE INDEX `idx_activity_logs_user_id` ON `activity_logs` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_activity_logs_action` ON `activity_logs` (`action`);
--> statement-breakpoint
CREATE INDEX `idx_activity_logs_resource` ON `activity_logs` (`resource`);
--> statement-breakpoint
CREATE INDEX `idx_activity_logs_user_created_at` ON `activity_logs` (`user_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `idx_activity_logs_user_created_at_id` ON `activity_logs` (`user_id`, `created_at`, `id`);
--> statement-breakpoint
CREATE INDEX `idx_activity_logs_user_action_created_id` ON `activity_logs` (`user_id`, `action`, `created_at`, `id`);
--> statement-breakpoint
CREATE INDEX `idx_activity_logs_resource_created_id` ON `activity_logs` (`resource`, `created_at`, `id`);
--> statement-breakpoint
CREATE INDEX `idx_activity_logs_resource_id` ON `activity_logs` (`resource`, `resource_id`);
--> statement-breakpoint

-- ============================================
-- EMAIL VERIFICATIONS
-- ============================================
CREATE TABLE `email_verifications` (
	`id` text(24) PRIMARY KEY NOT NULL,
	`user_id` text(24) NOT NULL,
	`email` text NOT NULL,
	`otp_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer NOT NULL DEFAULT 0,
	`max_attempts` integer NOT NULL DEFAULT 5,
	`verified` integer NOT NULL DEFAULT false,
	`last_sent_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
) WITHOUT ROWID;
--> statement-breakpoint
CREATE INDEX `idx_email_verifications_user_id` ON `email_verifications` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_email_verifications_email` ON `email_verifications` (`email`);
--> statement-breakpoint
CREATE INDEX `idx_email_verifications_user_email` ON `email_verifications` (`user_id`, `email`, `verified`);
--> statement-breakpoint

-- ============================================
-- OUTBOX EVENTS
-- ============================================
CREATE TABLE `outbox_events` (
	`id` text(24) PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`aggregate_type` text,
	`aggregate_id` text,
	`payload` text NOT NULL,
	`status` text NOT NULL DEFAULT 'pending',
	`attempts` integer NOT NULL DEFAULT 0,
	`max_attempts` integer NOT NULL DEFAULT 10,
	`available_at` integer NOT NULL,
	`processed_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_outbox_status_available_at` ON `outbox_events` (`status`, `available_at`, `created_at`);
--> statement-breakpoint
CREATE INDEX `idx_outbox_aggregate` ON `outbox_events` (`aggregate_type`, `aggregate_id`);
--> statement-breakpoint
CREATE INDEX `idx_outbox_event_type` ON `outbox_events` (`event_type`);
--> statement-breakpoint

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`data` text,
	`is_read` integer NOT NULL DEFAULT false,
	`read_at` integer,
	`created_at` integer NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_id` ON `notifications` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_read` ON `notifications` (`user_id`, `is_read`);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_created_at` ON `notifications` (`user_id`, `created_at`, `id`);
