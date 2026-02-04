-- Migration: Add Performance Indexes
-- Description: Add indexes to improve query performance for common operations
-- Date: 2026-02-04

-- ============================================
-- USER TABLE INDEXES
-- ============================================

-- Index for role-based queries (admin dashboard, role filtering)
CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users" ("role");
--> statement-breakpoint

-- Index for active user filtering
CREATE INDEX IF NOT EXISTS "idx_users_is_active" ON "users" ("is_active");
--> statement-breakpoint

-- Index for locked account queries
CREATE INDEX IF NOT EXISTS "idx_users_is_locked" ON "users" ("is_locked");
--> statement-breakpoint

-- Composite index for locked account cleanup (find locked accounts past lockout time)
CREATE INDEX IF NOT EXISTS "idx_users_locked_until" ON "users" ("is_locked", "lockout_until");
--> statement-breakpoint


-- ============================================
-- DEBT TABLE INDEXES
-- ============================================

-- Index for user's debts lookup (most common query - get debts where user is debtor)
CREATE INDEX IF NOT EXISTS "idx_debts_debtor_id" ON "debts" ("debtor_id");
--> statement-breakpoint

-- Index for user's debts lookup (get debts where user is creditor)
CREATE INDEX IF NOT EXISTS "idx_debts_creditor_id" ON "debts" ("creditor_id");
--> statement-breakpoint

-- Composite index for phone + status queries (public debt count lookup)
CREATE INDEX IF NOT EXISTS "idx_debts_debtor_phone_status" ON "debts" ("debtor_phone", "status");
--> statement-breakpoint

-- Composite index for creditor phone + status queries
CREATE INDEX IF NOT EXISTS "idx_debts_creditor_phone_status" ON "debts" ("creditor_phone", "status");
--> statement-breakpoint

-- Index for status filtering (dashboard, reports, filtering by status)
CREATE INDEX IF NOT EXISTS "idx_debts_status" ON "debts" ("status");
--> statement-breakpoint

-- Index for uploaded by (admin queries, user's uploads history)
CREATE INDEX IF NOT EXISTS "idx_debts_uploaded_by" ON "debts" ("uploaded_by_id");
--> statement-breakpoint

-- Composite index for date-based queries with status (reports, analytics)
CREATE INDEX IF NOT EXISTS "idx_debts_status_created_at" ON "debts" ("status", "created_at");
--> statement-breakpoint


-- ============================================
-- SESSION TABLE INDEXES
-- ============================================

-- Critical: Session lookup by user + status (most common query - get user's active sessions)
CREATE INDEX IF NOT EXISTS "idx_sessions_user_status" ON "sessions" ("user_id", "status");
--> statement-breakpoint

-- Access token lookup (authentication - called on every authenticated request)
CREATE INDEX IF NOT EXISTS "idx_sessions_access_token" ON "sessions" ("access_token");
--> statement-breakpoint

-- Composite index for session validation (user + access token + status)
CREATE INDEX IF NOT EXISTS "idx_sessions_user_access_status" ON "sessions" ("user_id", "access_token", "status");
--> statement-breakpoint

-- Cleanup queries - find expired sessions for batch cleanup
CREATE INDEX IF NOT EXISTS "idx_sessions_status_expires" ON "sessions" ("status", "refresh_token_expires_at");
--> statement-breakpoint

-- Soft delete cleanup - find sessions marked for deletion
CREATE INDEX IF NOT EXISTS "idx_sessions_deleted_at" ON "sessions" ("deleted_at");
--> statement-breakpoint
