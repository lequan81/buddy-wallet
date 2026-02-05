-- Migration: Hash Access Tokens in Database
-- Description: Add access_token_hash column to sessions table for enhanced security
-- Date: 2026-02-05
--
-- SECURITY ENHANCEMENT:
-- Currently access tokens are stored in plaintext. If database is compromised,
-- attacker can steal valid tokens. This migration adds hashed token storage.
--
-- BREAKING CHANGE:
-- All existing sessions will be invalidated. Users must re-login after deployment.

-- ============================================
-- 1. ADD NEW COLUMN FOR HASHED ACCESS TOKENS
-- ============================================

ALTER TABLE "sessions" ADD COLUMN "access_token_hash" TEXT;
--> statement-breakpoint

-- ============================================
-- 2. INVALIDATE ALL EXISTING SESSIONS
-- ============================================
-- This ensures clean migration - all users must re-login with new hashed tokens
-- Alternative: Could hash existing tokens, but cleaner to start fresh

UPDATE "sessions" SET "status" = 'expired' WHERE "status" = 'active';
--> statement-breakpoint

-- ============================================
-- 3. ADD INDEX FOR HASH LOOKUPS
-- ============================================
-- Critical for performance - authentication checks use this index

CREATE INDEX IF NOT EXISTS "idx_sessions_access_token_hash" ON "sessions" ("access_token_hash");
--> statement-breakpoint

-- ============================================
-- 4. UPDATE COMPOSITE INDEX
-- ============================================
-- Replace old access_token index with access_token_hash

DROP INDEX IF EXISTS "idx_sessions_access_token";
--> statement-breakpoint

DROP INDEX IF EXISTS "idx_sessions_user_access_status";
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_sessions_user_access_hash_status" ON "sessions" ("user_id", "access_token_hash", "status");
--> statement-breakpoint

-- ============================================
-- NOTES FOR ROLLBACK
-- ============================================
-- To rollback this migration:
-- 1. DROP COLUMN "access_token_hash"
-- 2. Recreate old indexes
-- 3. All sessions will still be expired - users must re-login
