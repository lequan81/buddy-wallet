CREATE INDEX IF NOT EXISTS idx_import_logs_user_status_created_at_id
  ON import_logs(user_id, status, created_at, id);

CREATE INDEX IF NOT EXISTS idx_import_logs_status_created_at_id
  ON import_logs(status, created_at, id);

CREATE INDEX IF NOT EXISTS idx_import_logs_preview_log_id
  ON import_logs(preview_log_id);
