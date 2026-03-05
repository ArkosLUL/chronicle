ALTER TABLE users
  DROP COLUMN IF EXISTS default_mobile_layout_id,
  DROP COLUMN IF EXISTS default_desktop_layout_id;
