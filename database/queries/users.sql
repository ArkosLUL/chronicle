-- name: InsertUser :one
INSERT INTO
  users(id, username, email, created_at, updated_at)
VALUES
  ($1, $2, $3, $4, $5)
RETURNING *
;

-- name: InsertUserAuth :one
INSERT INTO
  user_auth_links(id, linked_id, user_id, provider, created_at, updated_at)
VALUES
  ($1, $2, $3, $4, $5, $6)
RETURNING *
;

-- name: GetUserAuthByLinkedID :one
SELECT
  *
FROM
  user_auth_links
WHERE
  linked_id = $1 AND
  provider = $2
;


-- name: InsertUserAuthSession :one
INSERT INTO
  user_auth_session(id, user_id, user_auth_id, access_token, access_token_secret, refresh_token, expires_at, created_at, updated_at)
VALUES
  ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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