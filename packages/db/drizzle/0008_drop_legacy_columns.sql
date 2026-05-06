-- Migration: Drop legacy and unused columns
-- Date: 2026-04-29

-- Sessions: remove deprecated plaintext access token column
ALTER TABLE sessions DROP COLUMN access_token;
--> statement-breakpoint

-- File metadata: remove unused descriptive/review columns
ALTER TABLE file_metadata DROP COLUMN filename;
--> statement-breakpoint
ALTER TABLE file_metadata DROP COLUMN original_name;
--> statement-breakpoint
ALTER TABLE file_metadata DROP COLUMN reviewed_by_id;
--> statement-breakpoint
ALTER TABLE file_metadata DROP COLUMN reviewed_at;
--> statement-breakpoint
ALTER TABLE file_metadata DROP COLUMN rejection_reason;
