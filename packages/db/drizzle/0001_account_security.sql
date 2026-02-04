-- Migration: Add account security and session management fields
-- Description: Adds lockout mechanism, password tracking, and soft-delete support
-- Date: 2026-01-27

-- ============================================
-- USER TABLE SECURITY FIELDS
-- ============================================

-- Account lockout mechanism
ALTER TABLE `users` ADD `lockout_until` integer;
--> statement-breakpoint
ALTER TABLE `users` ADD `failed_login_attempts` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD `last_failed_login_at` integer;
--> statement-breakpoint

-- Email and phone verification
ALTER TABLE `users` ADD `email_verified` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD `phone_verified` integer DEFAULT false NOT NULL;
--> statement-breakpoint

-- ============================================
-- SESSION TABLE SOFT DELETE
-- ============================================

-- Soft delete support (Two-Stage deletion)
-- Stage 1: deletedAt set (record hidden from queries)
-- Stage 2: Hard delete by cleanup worker after 30 days
ALTER TABLE `sessions` ADD `deleted_at` integer;
--> statement-breakpoint

-- ============================================
-- IMPORT LOGS ENHANCEMENT
-- ============================================

-- Link to preview log for import history
ALTER TABLE `import_logs` ADD `preview_log_id` text;
