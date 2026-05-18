/** Mirrors the Go TelemetryReport struct from servicetelemetry/worker.go */
export interface TelemetryReport {
  deployment_id: string;
  deployment_created_at: string;
  version: string;
  git_commit: string;
  server_type: string;
  access_url: string;
  uptime_seconds: number;
  started_at: string;
  total_users: number;
  total_log_files: number;
  total_parsed_log_bytes: number;
  instances_by_zone: Record<string, number>;
}

export interface Env {
  DB: D1Database;
}

export interface DeploymentLatest {
  deployment_id: string;
  last_report_id: number;
  last_reported_at: string;
  version: string;
  server_type: string;
  access_url: string;
}

export interface StoredReport {
  id: number;
  deployment_id: string;
  deployment_created_at: string | null;
  version: string;
  git_commit: string;
  server_type: string;
  access_url: string;
  uptime_seconds: number;
  started_at: string | null;
  total_users: number;
  total_log_files: number;
  total_parsed_log_bytes: number;
  instances_by_zone: string;
  reported_at: string;
  remote_ip: string;
}
