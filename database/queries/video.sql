-- name: DeleteYoutubeVideoByInstanceOrSlug :exec
DELETE FROM log_instance_youtube_timestamped
WHERE log_instance_id = $1
   OR instance_slug = $2
;

-- name: InsertStampedYoutubeVideo :exec
INSERT INTO
  log_instance_youtube_timestamped (log_instance_id, instance_slug, created_at, exported_at, video_url, payload)
VALUES
  ($1, $2, $3, $4, $5, $6)
;

-- name: GetInstanceYoutubeData :one
SELECT
  *
FROM
  log_instance_youtube_timestamped
WHERE
  log_instance_id = @log_instance_id
  OR instance_slug = @instance_slug
LIMIT 1
;