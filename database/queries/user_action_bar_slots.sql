-- name: GetUserActionBarSlots :one
SELECT
  slot_1,
  slot_2,
  slot_3,
  slot_4,
  slot_5,
  slot_6,
  slot_7,
  slot_8,
  slot_9,
  slot_0
FROM user_action_bar_slots
WHERE user_id = $1;

-- name: UpsertUserActionBarSlots :one
INSERT INTO user_action_bar_slots (
  user_id,
  slot_1,
  slot_2,
  slot_3,
  slot_4,
  slot_5,
  slot_6,
  slot_7,
  slot_8,
  slot_9,
  slot_0
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
ON CONFLICT (user_id) DO UPDATE
SET
  slot_1 = EXCLUDED.slot_1,
  slot_2 = EXCLUDED.slot_2,
  slot_3 = EXCLUDED.slot_3,
  slot_4 = EXCLUDED.slot_4,
  slot_5 = EXCLUDED.slot_5,
  slot_6 = EXCLUDED.slot_6,
  slot_7 = EXCLUDED.slot_7,
  slot_8 = EXCLUDED.slot_8,
  slot_9 = EXCLUDED.slot_9,
  slot_0 = EXCLUDED.slot_0
RETURNING
  slot_1,
  slot_2,
  slot_3,
  slot_4,
  slot_5,
  slot_6,
  slot_7,
  slot_8,
  slot_9,
  slot_0;
