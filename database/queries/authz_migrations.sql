-- name: GetAppliedAuthzMigrations :many
SELECT version FROM authz_schema_migrations ORDER BY version;

-- name: RecordAuthzMigration :exec
INSERT INTO authz_schema_migrations (version) VALUES ($1);
