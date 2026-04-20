-- name: InsertUserPassword :one
INSERT INTO user_passwords (user_auth_id, password_hash, updated_at)
VALUES (@user_auth_id, @password_hash, @updated_at)
RETURNING *;

-- name: GetUserPasswordByAuthID :one
SELECT * FROM user_passwords WHERE user_auth_id = @user_auth_id;

-- name: UpdateUserPassword :exec
UPDATE user_passwords SET password_hash = @password_hash, updated_at = now()
WHERE user_auth_id = @user_auth_id;
