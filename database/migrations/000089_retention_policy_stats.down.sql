ALTER TABLE retention_policies
  DROP COLUMN last_run_at,
  DROP COLUMN total_deleted,
  DROP COLUMN total_kept;
