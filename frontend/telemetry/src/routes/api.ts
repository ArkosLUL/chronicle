import { Hono } from "hono";
import type { Env, DeploymentLatest, StoredReport } from "../types";

const api = new Hono<{ Bindings: Env }>();

// List all deployments (latest report per deployment).
api.get("/internal/api/v1/deployments", async (c) => {
  const serverType = c.req.query("server_type");
  const db = c.env.DB;

  let query = "SELECT * FROM deployment_latest";
  const binds: string[] = [];

  if (serverType) {
    query += " WHERE server_type = ?";
    binds.push(serverType);
  }
  query += " ORDER BY last_reported_at DESC";

  const { results } = await db
    .prepare(query)
    .bind(...binds)
    .all<DeploymentLatest>();

  return c.json({ deployments: results ?? [] });
});

// Report history for a single deployment.
api.get("/internal/api/v1/deployments/:id", async (c) => {
  const deploymentId = c.req.param("id");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50"), 200);

  const db = c.env.DB;
  const { results } = await db
    .prepare(
      `SELECT * FROM telemetry_reports
       WHERE deployment_id = ?
       ORDER BY reported_at DESC
       LIMIT ?`
    )
    .bind(deploymentId, limit)
    .all<StoredReport>();

  return c.json({ deployment_id: deploymentId, reports: results ?? [] });
});

// Aggregate stats.
api.get("/internal/api/v1/stats", async (c) => {
  const db = c.env.DB;

  const [totalDeploy, active7d, active30d, byVersion, byServerType, totals] =
    await Promise.all([
      db
        .prepare("SELECT COUNT(*) as count FROM deployment_latest")
        .first<{ count: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) as count FROM deployment_latest
           WHERE last_reported_at >= datetime('now', '-7 days')`
        )
        .first<{ count: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) as count FROM deployment_latest
           WHERE last_reported_at >= datetime('now', '-30 days')`
        )
        .first<{ count: number }>(),
      db
        .prepare(
          `SELECT dl.version, COUNT(*) as count
           FROM deployment_latest dl
           GROUP BY dl.version
           ORDER BY count DESC`
        )
        .all<{ version: string; count: number }>(),
      db
        .prepare(
          `SELECT dl.server_type, COUNT(*) as count
           FROM deployment_latest dl
           GROUP BY dl.server_type
           ORDER BY count DESC`
        )
        .all<{ server_type: string; count: number }>(),
      db
        .prepare(
          `SELECT
             COALESCE(SUM(r.total_users), 0) as total_users,
             COALESCE(SUM(r.total_log_files), 0) as total_log_files
           FROM deployment_latest dl
           JOIN telemetry_reports r ON r.id = dl.last_report_id`
        )
        .first<{ total_users: number; total_log_files: number }>(),
    ]);

  return c.json({
    deployments: {
      total: totalDeploy?.count ?? 0,
      active_7d: active7d?.count ?? 0,
      active_30d: active30d?.count ?? 0,
    },
    by_version: byVersion.results ?? [],
    by_server_type: byServerType.results ?? [],
    totals: {
      total_users: totals?.total_users ?? 0,
      total_log_files: totals?.total_log_files ?? 0,
    },
  });
});

export default api;
