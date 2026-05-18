-- Chronicle Telemetry D1 Schema

CREATE TABLE telemetry_reports (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    deployment_id   TEXT NOT NULL,
    deployment_created_at TEXT,
    version         TEXT NOT NULL,
    git_commit      TEXT NOT NULL DEFAULT '',
    server_type     TEXT NOT NULL DEFAULT '',
    access_url      TEXT NOT NULL DEFAULT '',
    uptime_seconds  INTEGER NOT NULL DEFAULT 0,
    started_at      TEXT,
    total_users     INTEGER NOT NULL DEFAULT 0,
    total_log_files INTEGER NOT NULL DEFAULT 0,
    total_parsed_log_bytes INTEGER NOT NULL DEFAULT 0,
    instances_by_zone TEXT NOT NULL DEFAULT '{}',
    reported_at     TEXT NOT NULL DEFAULT (datetime('now')),
    remote_ip       TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_reports_deployment_id ON telemetry_reports(deployment_id);
CREATE INDEX idx_reports_reported_at ON telemetry_reports(reported_at);

CREATE TABLE deployment_latest (
    deployment_id    TEXT PRIMARY KEY,
    last_report_id   INTEGER NOT NULL REFERENCES telemetry_reports(id),
    last_reported_at TEXT NOT NULL,
    version          TEXT NOT NULL,
    server_type      TEXT NOT NULL DEFAULT '',
    access_url       TEXT NOT NULL DEFAULT ''
);
