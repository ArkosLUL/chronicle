import { Hono } from "hono";
import { html } from "hono/html";
import type { Env, DeploymentLatest, StoredReport } from "../types";

const dashboard = new Hono<{ Bindings: Env }>();

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr + "Z").getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Main dashboard page.
dashboard.get("/internal", async (c) => {
  const db = c.env.DB;

  const [deploymentsRes, statsRow, byVersion, byServerType] = await Promise.all(
    [
      db
        .prepare(
          "SELECT * FROM deployment_latest ORDER BY last_reported_at DESC"
        )
        .all<DeploymentLatest>(),
      db
        .prepare(
          `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN last_reported_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as active_7d,
           COALESCE((SELECT SUM(r.total_users) FROM deployment_latest dl2 JOIN telemetry_reports r ON r.id = dl2.last_report_id), 0) as total_users,
           COALESCE((SELECT SUM(r.total_log_files) FROM deployment_latest dl3 JOIN telemetry_reports r ON r.id = dl3.last_report_id), 0) as total_log_files
         FROM deployment_latest`
        )
        .first<{
          total: number;
          active_7d: number;
          total_users: number;
          total_log_files: number;
        }>(),
      db
        .prepare(
          `SELECT version, COUNT(*) as count FROM deployment_latest GROUP BY version ORDER BY count DESC LIMIT 10`
        )
        .all<{ version: string; count: number }>(),
      db
        .prepare(
          `SELECT server_type, COUNT(*) as count FROM deployment_latest GROUP BY server_type ORDER BY count DESC LIMIT 10`
        )
        .all<{ server_type: string; count: number }>(),
    ]
  );

  const deployments = deploymentsRes.results ?? [];
  const stats = statsRow ?? {
    total: 0,
    active_7d: 0,
    total_users: 0,
    total_log_files: 0,
  };
  const versions = byVersion.results ?? [];
  const serverTypes = byServerType.results ?? [];

  const topVersion = versions.length > 0 ? versions[0].version : "—";

  return c.html(
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Chronicle Telemetry</title>
        {html`<style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0f1117; color: #e1e4e8; padding: 24px; max-width: 1200px; margin: 0 auto; }
          h1 { font-size: 24px; font-weight: 600; margin-bottom: 24px; color: #f0f0f0; }
          h2 { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #c9d1d9; }
          .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
          .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; }
          .card .label { font-size: 12px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
          .card .value { font-size: 28px; font-weight: 700; color: #58a6ff; }
          .card .value.green { color: #3fb950; }
          .card .value.purple { color: #bc8cff; }
          .card .value.orange { color: #d29922; }
          .section { margin-bottom: 32px; }
          .bar-chart { display: flex; flex-direction: column; gap: 6px; }
          .bar-row { display: flex; align-items: center; gap: 8px; font-size: 13px; }
          .bar-label { min-width: 120px; text-align: right; color: #8b949e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .bar-track { flex: 1; height: 20px; background: #21262d; border-radius: 4px; overflow: hidden; }
          .bar-fill { height: 100%; border-radius: 4px; min-width: 2px; }
          .bar-fill.blue { background: #58a6ff; }
          .bar-fill.green { background: #3fb950; }
          .bar-count { min-width: 30px; font-size: 12px; color: #8b949e; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #30363d; color: #8b949e; font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
          td { padding: 8px 12px; border-bottom: 1px solid #21262d; }
          tr:hover td { background: #161b22; }
          a { color: #58a6ff; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .mono { font-family: 'SF Mono', SFMono-Regular, Consolas, monospace; font-size: 12px; }
          .text-muted { color: #8b949e; }
          .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
          @media (max-width: 768px) { .charts-row { grid-template-columns: 1fr; } }
        </style>`}
      </head>
      <body>
        <h1>📡 Chronicle Telemetry</h1>

        <div class="cards">
          <div class="card">
            <div class="label">Total Deployments</div>
            <div class="value">{stats.total}</div>
          </div>
          <div class="card">
            <div class="label">Active (7d)</div>
            <div class="value green">{stats.active_7d}</div>
          </div>
          <div class="card">
            <div class="label">Total Users</div>
            <div class="value purple">{stats.total_users}</div>
          </div>
          <div class="card">
            <div class="label">Total Log Files</div>
            <div class="value orange">{stats.total_log_files}</div>
          </div>
          <div class="card">
            <div class="label">Top Version</div>
            <div class="value" style="font-size: 20px">{topVersion}</div>
          </div>
        </div>

        <div class="charts-row">
          <div class="section">
            <h2>By Version</h2>
            <div class="bar-chart">
              {versions.map((v) => {
                const maxCount = versions[0]?.count ?? 1;
                const pct = Math.max((v.count / maxCount) * 100, 2);
                return (
                  <div class="bar-row">
                    <span class="bar-label">{v.version}</span>
                    <div class="bar-track">
                      <div
                        class="bar-fill blue"
                        style={`width: ${pct}%`}
                      />
                    </div>
                    <span class="bar-count">{v.count}</span>
                  </div>
                );
              })}
              {versions.length === 0 && (
                <span class="text-muted">No data yet</span>
              )}
            </div>
          </div>

          <div class="section">
            <h2>By Server Type</h2>
            <div class="bar-chart">
              {serverTypes.map((s) => {
                const maxCount = serverTypes[0]?.count ?? 1;
                const pct = Math.max((s.count / maxCount) * 100, 2);
                return (
                  <div class="bar-row">
                    <span class="bar-label">{s.server_type || "unknown"}</span>
                    <div class="bar-track">
                      <div
                        class="bar-fill green"
                        style={`width: ${pct}%`}
                      />
                    </div>
                    <span class="bar-count">{s.count}</span>
                  </div>
                );
              })}
              {serverTypes.length === 0 && (
                <span class="text-muted">No data yet</span>
              )}
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Deployments</h2>
          <table>
            <thead>
              <tr>
                <th>Deployment ID</th>
                <th>Version</th>
                <th>Server</th>
                <th>Access URL</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((d) => (
                <tr>
                  <td>
                    <a
                      href={`/internal/deployment/${d.deployment_id}`}
                      class="mono"
                    >
                      {d.deployment_id.substring(0, 8)}…
                    </a>
                  </td>
                  <td class="mono">{d.version}</td>
                  <td>{d.server_type || "—"}</td>
                  <td class="text-muted" style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    {d.access_url ? (
                      <a href={d.access_url} target="_blank" rel="noopener">
                        {d.access_url}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td class="text-muted">{timeAgo(d.last_reported_at)}</td>
                </tr>
              ))}
              {deployments.length === 0 && (
                <tr>
                  <td colspan={5} class="text-muted" style="text-align: center; padding: 24px;">
                    No telemetry reports received yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  );
});

// Deployment detail page.
dashboard.get("/internal/deployment/:id", async (c) => {
  const deploymentId = c.req.param("id");
  const db = c.env.DB;

  const { results: reports } = await db
    .prepare(
      `SELECT * FROM telemetry_reports WHERE deployment_id = ? ORDER BY reported_at DESC LIMIT 100`
    )
    .bind(deploymentId)
    .all<StoredReport>();

  const latest = reports?.[0];

  return c.html(
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Deployment {deploymentId.substring(0, 8)} — Chronicle Telemetry</title>
        {html`<style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0f1117; color: #e1e4e8; padding: 24px; max-width: 1200px; margin: 0 auto; }
          h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; color: #f0f0f0; }
          h2 { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #c9d1d9; }
          a { color: #58a6ff; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .back { margin-bottom: 16px; display: inline-block; font-size: 13px; }
          .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 32px; }
          .meta-item { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 12px; }
          .meta-item .label { font-size: 11px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; }
          .meta-item .val { font-size: 16px; font-weight: 600; margin-top: 2px; }
          .mono { font-family: 'SF Mono', SFMono-Regular, Consolas, monospace; font-size: 12px; }
          .text-muted { color: #8b949e; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #30363d; color: #8b949e; font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
          td { padding: 8px 12px; border-bottom: 1px solid #21262d; }
        </style>`}
      </head>
      <body>
        <a href="/internal" class="back">← Back to dashboard</a>
        <h1>Deployment <span class="mono">{deploymentId}</span></h1>
        {latest && (
          <p class="text-muted" style="margin-bottom: 20px;">
            Created {latest.deployment_created_at ?? "unknown"} · Last seen {timeAgo(latest.reported_at)}
          </p>
        )}

        {latest && (
          <div class="meta">
            <div class="meta-item">
              <div class="label">Version</div>
              <div class="val mono">{latest.version}</div>
            </div>
            <div class="meta-item">
              <div class="label">Server Type</div>
              <div class="val">{latest.server_type || "—"}</div>
            </div>
            <div class="meta-item">
              <div class="label">Access URL</div>
              <div class="val mono" style="font-size: 13px; word-break: break-all;">
                {latest.access_url || "—"}
              </div>
            </div>
            <div class="meta-item">
              <div class="label">Users</div>
              <div class="val">{latest.total_users}</div>
            </div>
            <div class="meta-item">
              <div class="label">Log Files</div>
              <div class="val">{latest.total_log_files}</div>
            </div>
            <div class="meta-item">
              <div class="label">Parsed Data</div>
              <div class="val">{formatBytes(latest.total_parsed_log_bytes)}</div>
            </div>
            <div class="meta-item">
              <div class="label">Uptime</div>
              <div class="val">{Math.floor(latest.uptime_seconds / 3600)}h {Math.floor((latest.uptime_seconds % 3600) / 60)}m</div>
            </div>
            <div class="meta-item">
              <div class="label">Remote IP</div>
              <div class="val mono">{latest.remote_ip || "—"}</div>
            </div>
          </div>
        )}

        {latest && (() => {
          try {
            const zones: Record<string, number> = JSON.parse(latest.instances_by_zone);
            const entries = Object.entries(zones).sort(([, a], [, b]) => b - a);
            if (entries.length === 0) return null;
            return (
              <div style="margin-bottom: 32px;">
                <h2>Instances by Zone</h2>
                <table>
                  <thead>
                    <tr><th>Zone</th><th>Count</th></tr>
                  </thead>
                  <tbody>
                    {entries.map(([zone, count]) => (
                      <tr><td>{zone}</td><td>{count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          } catch { return null; }
        })()}

        <div>
          <h2>Report History ({(reports ?? []).length} reports)</h2>
          <table>
            <thead>
              <tr>
                <th>Reported At</th>
                <th>Version</th>
                <th>Uptime</th>
                <th>Users</th>
                <th>Logs</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {(reports ?? []).map((r) => (
                <tr>
                  <td class="mono">{r.reported_at}</td>
                  <td class="mono">{r.version}</td>
                  <td>{Math.floor(r.uptime_seconds / 3600)}h {Math.floor((r.uptime_seconds % 3600) / 60)}m</td>
                  <td>{r.total_users}</td>
                  <td>{r.total_log_files}</td>
                  <td class="mono text-muted">{r.remote_ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  );
});

export default dashboard;
