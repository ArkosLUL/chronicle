BEGIN;

-- Expand spell_templates with additional fields for tooltip display and filtering
ALTER TABLE spell_templates 
  ADD COLUMN IF NOT EXISTS subtext TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS aura_description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS icon_id INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS school_mask INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS power_type INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mana_cost INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mana_cost_pct INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cast_time_index INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovery_time INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS range_index INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attributes BIGINT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS targets INT DEFAULT 0;

COMMENT ON COLUMN spell_templates.subtext IS 'Rank text like "Rank 1", "Passive", etc.';
COMMENT ON COLUMN spell_templates.aura_description IS 'Description shown when spell is an aura/buff';
COMMENT ON COLUMN spell_templates.icon_id IS 'SpellIconID for icon lookup';
COMMENT ON COLUMN spell_templates.school_mask IS 'Bitmask: 1=phys, 2=holy, 4=fire, 8=nature, 16=frost, 32=shadow, 64=arcane';
COMMENT ON COLUMN spell_templates.power_type IS '0=mana, 1=rage, 2=focus, 3=energy';
COMMENT ON COLUMN spell_templates.cast_time_index IS 'Index into SpellCastTimes.dbc';
COMMENT ON COLUMN spell_templates.recovery_time IS 'Cooldown in milliseconds';
COMMENT ON COLUMN spell_templates.range_index IS 'Index into SpellRange.dbc';
COMMENT ON COLUMN spell_templates.attributes IS '9-element array of uint32 attribute bitmasks';
COMMENT ON COLUMN spell_templates.targets IS 'Target flags bitmask';

COMMIT;
