-- name: InsertUser :one
INSERT INTO
  users(id, username)
VALUES
  ($1, $2)
RETURNING *
;

-- name: GetUserByID :one
SELECT
  *
FROM
  users
WHERE
  id = $1
;