CREATE TABLE user_action_bar_slots (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  slot_1  uuid,
  slot_2  uuid,
  slot_3  uuid,
  slot_4  uuid,
  slot_5  uuid,
  slot_6  uuid,
  slot_7  uuid,
  slot_8  uuid,
  slot_9  uuid,
  slot_0  uuid
);
