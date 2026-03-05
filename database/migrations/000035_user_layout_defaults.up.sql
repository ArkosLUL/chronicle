ALTER TABLE users
  ADD COLUMN default_desktop_layout_id uuid REFERENCES user_panel_layouts(id) ON DELETE SET NULL,
  ADD COLUMN default_mobile_layout_id uuid REFERENCES user_panel_layouts(id) ON DELETE SET NULL;
