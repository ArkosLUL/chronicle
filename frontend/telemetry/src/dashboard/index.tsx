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
          `SELECT dl.*, r.total_log_files, r.total_users as report_users, r.instances_by_zone
           FROM deployment_latest dl
           JOIN telemetry_reports r ON r.id = dl.last_report_id
           ORDER BY dl.last_reported_at DESC`
        )
        .all<DeploymentLatest & { total_log_files: number; report_users: number; instances_by_zone: string }>(),
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

  const rawDeployments = (deploymentsRes.results ?? []).map((d) => {
    let totalInstances = 0;
    try {
      const zones: Record<string, number> = JSON.parse(d.instances_by_zone || "{}");
      totalInstances = Object.values(zones).reduce((a, b) => a + b, 0);
    } catch { /* ignore */ }
    return { ...d, total_instances: totalInstances };
  });
  const deployments = rawDeployments;
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
        <link rel="icon" href="https://chronicleclassic.com/c/chronicle/ChronicleFavicon.png" type="image/png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet" />
        {html`<style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', system-ui, sans-serif; background: #1a1a1a; color: #e8e8e8; padding: 32px; max-width: 1200px; margin: 0 auto; }
          h1 { font-size: 22px; font-weight: 600; margin-bottom: 24px; color: #f0f0f0; display: flex; align-items: center; gap: 10px; }
          h1 span { color: #5F8FA6; }
          h2 { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
          .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 32px; }
          .card { background: #222; border: 1px solid #333; border-radius: 8px; padding: 18px; }
          .card .label { font-size: 11px; color: #777; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
          .card .value { font-size: 28px; font-weight: 700; color: #5F8FA6; }
          .card .value.green { color: #5FA67E; }
          .card .value.purple { color: #8F7EBD; }
          .card .value.orange { color: #A6895F; }
          .section { margin-bottom: 32px; }
          .bar-chart { display: flex; flex-direction: column; gap: 6px; }
          .bar-row { display: flex; align-items: center; gap: 8px; font-size: 13px; }
          .bar-label { min-width: 120px; text-align: right; color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .bar-track { flex: 1; height: 20px; background: #2a2a2a; border-radius: 4px; overflow: hidden; }
          .bar-fill { height: 100%; border-radius: 4px; min-width: 2px; }
          .bar-fill.blue { background: #5F8FA6; }
          .bar-fill.green { background: #5FA67E; }
          .bar-count { min-width: 30px; font-size: 12px; color: #888; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { text-align: left; padding: 10px 12px; border-bottom: 1px solid #333; color: #777; font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
          td { padding: 10px 12px; border-bottom: 1px solid #272727; }
          tr:hover td { background: #252525; }
          a { color: #5F8FA6; text-decoration: none; }
          a:hover { color: #7fb3cc; }
          .mono { font-family: 'Roboto Mono', monospace; font-size: 12px; }
          .text-muted { color: #777; }
          .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
          .charts-row .section { background: #222; border: 1px solid #333; border-radius: 8px; padding: 18px; margin-bottom: 0; }
          .sortable { cursor: pointer; user-select: none; position: relative; padding-right: 18px !important; }
          .sortable:hover { color: #5F8FA6; }
          .sortable::after { content: '⇅'; position: absolute; right: 2px; opacity: 0.3; font-size: 10px; }
          .sortable.sort-asc::after { content: '↑'; opacity: 0.8; color: #5F8FA6; }
          .sortable.sort-desc::after { content: '↓'; opacity: 0.8; color: #5F8FA6; }
          @media (max-width: 768px) { .charts-row { grid-template-columns: 1fr; } }
        </style>`}
      </head>
      <body>
        <h1>Chronicle <span>Telemetry</span></h1>

        <div class="cards">
          <div class="card">
            <div class="label">Total Deployments</div>
            <div class="value" id="stat-total">{stats.total}</div>
          </div>
          <div class="card">
            <div class="label">Active (7d)</div>
            <div class="value green" id="stat-active">{stats.active_7d}</div>
          </div>
          <div class="card">
            <div class="label">Total Users</div>
            <div class="value purple" id="stat-users">{stats.total_users}</div>
          </div>
          <div class="card">
            <div class="label">Total Log Files</div>
            <div class="value orange" id="stat-logs">{stats.total_log_files}</div>
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
          <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 16px;">
            <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #888; cursor: pointer;">
              <input type="checkbox" id="omit-localhost" style="accent-color: #5F8FA6;" />
              Omit localhost
            </label>
            <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #888; cursor: pointer;">
              <input type="checkbox" id="show-dev" style="accent-color: #5F8FA6;" />
              Show dev
            </label>
          </div>
          <table id="deployments-table">
            <thead>
              <tr>
                <th class="sortable" data-col="id">Deployment ID</th>
                <th class="sortable" data-col="version">Version</th>
                <th class="sortable" data-col="server">Server</th>
                <th>Access URL</th>
                <th class="sortable" data-col="users" data-type="num">Users</th>
                <th class="sortable" data-col="logs" data-type="num">Log Files</th>
                <th class="sortable" data-col="instances" data-type="num">Instances</th>
                <th class="sortable" data-col="seen" data-type="date">Last Seen</th>
                <th style="width: 70px;"></th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((d) => {
                const isLocalhost = /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/.test(d.access_url || "");
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                const isActive = d.last_reported_at >= sevenDaysAgo.slice(0, 19) ? "1" : "0";
                const isDev = d.is_dev === 1;
                return (
                  <tr data-localhost={isLocalhost ? "1" : "0"} data-dev={isDev ? "1" : "0"} data-active={isActive} data-users={d.report_users} data-logs={d.total_log_files} data-did={d.deployment_id}>
                    <td data-val={d.deployment_id}>
                      <a
                        href={`/internal/deployment/${d.deployment_id}`}
                        class="mono"
                      >
                        {d.deployment_id.substring(0, 8)}…
                      </a>
                      {isDev && <span class="dev-badge" style="margin-left: 6px; font-size: 10px; color: #A6895F; border: 1px solid #A6895F33; padding: 1px 5px; border-radius: 3px;">DEV</span>}
                    </td>
                    <td data-val={d.version} class="mono">{d.version}</td>
                    <td data-val={d.server_type || ""}>{d.server_type || "—"}</td>
                    <td class="text-muted" style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      {d.access_url ? (
                        <a href={d.access_url} target="_blank" rel="noopener">
                          {d.access_url}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td data-val={d.report_users}>{d.report_users}</td>
                    <td data-val={d.total_log_files}>{d.total_log_files}</td>
                    <td data-val={d.total_instances}>{d.total_instances}</td>
                    <td data-val={d.last_reported_at} class="text-muted">{timeAgo(d.last_reported_at)}</td>
                    <td>
                      <button class="dev-toggle" data-did={d.deployment_id} data-dev={isDev ? "1" : "0"}
                        style={`font-size:11px;padding:3px 8px;border-radius:4px;cursor:pointer;border:1px solid #333;background:${isDev ? "#2a2518" : "#222"};color:${isDev ? "#A6895F" : "#777"};`}>
                        {isDev ? "Unmark" : "Dev"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {deployments.length === 0 && (
                <tr>
                  <td colspan={9} class="text-muted" style="text-align: center; padding: 24px;">
                    No telemetry reports received yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {html`<script>
        (function() {
          const table = document.getElementById('deployments-table');
          const tbody = table.querySelector('tbody');
          const omitLH = document.getElementById('omit-localhost');
          const showDev = document.getElementById('show-dev');
          let sortCol = null, sortAsc = true;

          // Sort
          table.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => {
              const col = Array.from(th.parentNode.children).indexOf(th);
              const isNum = th.dataset.type === 'num';
              const isDate = th.dataset.type === 'date';
              if (sortCol === col) { sortAsc = !sortAsc; } else { sortCol = col; sortAsc = true; }
              table.querySelectorAll('th.sortable').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
              th.classList.add(sortAsc ? 'sort-asc' : 'sort-desc');
              const rows = Array.from(tbody.querySelectorAll('tr'));
              rows.sort((a, b) => {
                const av = a.children[col]?.dataset.val ?? a.children[col]?.textContent ?? '';
                const bv = b.children[col]?.dataset.val ?? b.children[col]?.textContent ?? '';
                let cmp;
                if (isNum) { cmp = (parseFloat(av) || 0) - (parseFloat(bv) || 0); }
                else if (isDate) { cmp = av.localeCompare(bv); }
                else { cmp = av.localeCompare(bv, undefined, { sensitivity: 'base' }); }
                return sortAsc ? cmp : -cmp;
              });
              rows.forEach(r => tbody.appendChild(r));
            });
          });

          // Filter rows + recompute stats
          function updateView() {
            const hideLH = omitLH.checked;
            const hideDev = !showDev.checked;
            let total = 0, active = 0, users = 0, logs = 0;
            tbody.querySelectorAll('tr').forEach(r => {
              const isLH = r.dataset.localhost === '1';
              const isDev = r.dataset.dev === '1';
              const hidden = (hideLH && isLH) || (hideDev && isDev);
              r.style.display = hidden ? 'none' : '';
              if (hidden) return;
              total++;
              if (r.dataset.active === '1') active++;
              users += parseInt(r.dataset.users || '0');
              logs += parseInt(r.dataset.logs || '0');
            });
            document.getElementById('stat-total').textContent = total;
            document.getElementById('stat-active').textContent = active;
            document.getElementById('stat-users').textContent = users;
            document.getElementById('stat-logs').textContent = logs;
          }
          omitLH.addEventListener('change', updateView);
          showDev.addEventListener('change', updateView);
          // Hide dev rows by default on load
          updateView();

          // Dev toggle buttons
          document.querySelectorAll('.dev-toggle').forEach(btn => {
            btn.addEventListener('click', async () => {
              const did = btn.dataset.did;
              const wasDev = btn.dataset.dev === '1';
              const newDev = !wasDev;
              btn.disabled = true;
              btn.textContent = '…';
              try {
                await fetch('/internal/api/v1/deployments/' + did + '/dev', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ is_dev: newDev }),
                });
                btn.dataset.dev = newDev ? '1' : '0';
                btn.textContent = newDev ? 'Unmark' : 'Dev';
                btn.style.background = newDev ? '#2a2518' : '#222';
                btn.style.color = newDev ? '#A6895F' : '#777';
                // Update the row's data-dev attribute
                const row = btn.closest('tr');
                row.dataset.dev = newDev ? '1' : '0';
                // Update the badge in the first cell
                const firstTd = row.children[0];
                const badge = firstTd.querySelector('.dev-badge');
                if (newDev && !badge) {
                  const span = document.createElement('span');
                  span.className = 'dev-badge';
                  span.style.cssText = 'margin-left:6px;font-size:10px;color:#A6895F;border:1px solid #A6895F33;padding:1px 5px;border-radius:3px;';
                  span.textContent = 'DEV';
                  firstTd.appendChild(span);
                } else if (!newDev && badge) {
                  badge.remove();
                }
                updateView();
              } catch (e) {
                btn.textContent = 'Error';
              }
              btn.disabled = false;
            });
          });
        })();
        </script>`}
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
        <link rel="icon" href="https://chronicleclassic.com/c/chronicle/ChronicleFavicon.png" type="image/png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet" />
        {html`<style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', system-ui, sans-serif; background: #1a1a1a; color: #e8e8e8; padding: 32px; max-width: 1200px; margin: 0 auto; }
          h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; color: #f0f0f0; }
          h2 { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
          a { color: #5F8FA6; text-decoration: none; }
          a:hover { color: #7fb3cc; }
          .back { margin-bottom: 16px; display: inline-block; font-size: 13px; color: #777; }
          .back:hover { color: #5F8FA6; }
          .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 32px; }
          .meta-item { background: #222; border: 1px solid #333; border-radius: 8px; padding: 14px; }
          .meta-item .label { font-size: 11px; color: #777; text-transform: uppercase; letter-spacing: 0.5px; }
          .meta-item .val { font-size: 16px; font-weight: 600; margin-top: 4px; color: #e8e8e8; }
          .mono { font-family: 'Roboto Mono', monospace; font-size: 12px; }
          .text-muted { color: #777; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { text-align: left; padding: 10px 12px; border-bottom: 1px solid #333; color: #777; font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
          td { padding: 10px 12px; border-bottom: 1px solid #272727; }
          tr:hover td { background: #252525; }
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
