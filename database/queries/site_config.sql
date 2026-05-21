-- name: GetSiteConfig :one
SELECT * FROM site_config WHERE id = TRUE;

-- name: UpdateSiteConfig :one
UPDATE site_config SET
    signups_enabled = COALESCE(sqlc.narg('signups_enabled'), signups_enabled),
    branding = COALESCE(sqlc.narg('branding'), branding),
    updated_at = now()
WHERE id = TRUE
RETURNING *;
