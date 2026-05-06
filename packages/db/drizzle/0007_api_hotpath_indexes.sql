-- Migration: API hot-path indexes
-- Date: 2026-04-29

-- Notifications: list/unread/count by user
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON notifications (user_id);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications (user_id, is_read);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON notifications (user_id, created_at, id);
--> statement-breakpoint

-- File metadata: listing and debt proof workflow
CREATE INDEX IF NOT EXISTS idx_file_metadata_uploaded_by
  ON file_metadata (uploaded_by_id);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_file_metadata_uploaded_type
  ON file_metadata (uploaded_by_id, file_type);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_file_metadata_debt_type_status
  ON file_metadata (related_debt_id, file_type, status);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_file_metadata_created_at
  ON file_metadata (created_at);
--> statement-breakpoint

-- Bank account default-selection path
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_default
  ON bank_accounts (user_id, is_default);
