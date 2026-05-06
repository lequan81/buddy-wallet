-- Migration: Simplify file metadata schema
-- Date: 2026-04-29

-- Drop indexes that depend on deprecated columns
DROP INDEX IF EXISTS idx_file_metadata_uploaded_type;
--> statement-breakpoint
DROP INDEX IF EXISTS idx_file_metadata_debt_type_status;
--> statement-breakpoint

-- Drop deprecated workflow/mapping columns
ALTER TABLE file_metadata DROP COLUMN file_type;
--> statement-breakpoint
ALTER TABLE file_metadata DROP COLUMN related_debt_id;
--> statement-breakpoint
ALTER TABLE file_metadata DROP COLUMN status;
--> statement-breakpoint

-- Add normalized indexes for ownership and listing
CREATE INDEX IF NOT EXISTS idx_file_metadata_uploaded_created_at
  ON file_metadata (uploaded_by_id, created_at, id);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_file_metadata_storage_path
  ON file_metadata (storage_path);
