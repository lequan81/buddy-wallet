-- Migration: Add session management fields (Facebook/Instagram style)
-- Date: 2026-01-27

-- Add session status and soft delete fields
ALTER TABLE sessions ADD COLUMN status TEXT DEFAULT 'active' NOT NULL;
ALTER TABLE sessions ADD COLUMN revoked_at INTEGER;
ALTER TABLE sessions ADD COLUMN revoked_reason TEXT;

-- Add device information fields
ALTER TABLE sessions ADD COLUMN device_name TEXT;
ALTER TABLE sessions ADD COLUMN device_type TEXT;
ALTER TABLE sessions ADD COLUMN location TEXT;

-- Add last active tracking
ALTER TABLE sessions ADD COLUMN last_active_at INTEGER;

-- Add session version to users for bulk invalidation
ALTER TABLE users ADD COLUMN session_version INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE users ADD COLUMN last_password_change_at INTEGER;

-- Create index for faster session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_status ON sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
