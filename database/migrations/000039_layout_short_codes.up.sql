ALTER TABLE user_panel_layouts
  ADD COLUMN code TEXT UNIQUE;

CREATE INDEX idx_user_panel_layouts_code ON user_panel_layouts(code);
