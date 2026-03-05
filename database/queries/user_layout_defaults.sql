-- name: GetUserPanelLayoutDefaults :one
SELECT
  default_desktop_layout_id,
  default_mobile_layout_id
FROM users
WHERE id = $1;

-- name: UpdateUserPanelLayoutDefaults :one
UPDATE users
SET
  default_desktop_layout_id = $2,
  default_mobile_layout_id = $3
WHERE id = $1
RETURNING
  default_desktop_layout_id,
  default_mobile_layout_id;
