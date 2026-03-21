CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created_at_id
  ON activity_logs (user_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_import_logs_user_created_at_id
  ON import_logs (user_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_debts_status_created_at_id
  ON debts (status, created_at, id);

CREATE INDEX IF NOT EXISTS idx_debts_debtor_created_at_id
  ON debts (debtor_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_debts_creditor_created_at_id
  ON debts (creditor_id, created_at, id);
