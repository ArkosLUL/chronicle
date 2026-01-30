-- name: InsertStampedYoutubeVideo :exec
INSERT INTO
  log_instance_youtube_timestamped (log_instance_id, created_at, exported_at, video_url, payload)
VALUES
  ($1, $2, $3, $4, $5)
ON CONFLICT (log_instance_id) DO UPDATE
SET
  created_at = EXCLUDED.created_at,
  exported_at = EXCLUDED.exported_at,
  video_url = EXCLUDED.video_url,
  payload = EXCLUDED.payload
;

-- name: GetInstanceYoutubeData :one
SELECT
  *
FROM
  log_instance_youtube_timestamped
WHERE
  log_instance_id = $1
;