ALTER TABLE telemetry_reports ADD COLUMN active_file_bytes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE telemetry_reports ADD COLUMN deleted_file_bytes INTEGER NOT NULL DEFAULT 0;
