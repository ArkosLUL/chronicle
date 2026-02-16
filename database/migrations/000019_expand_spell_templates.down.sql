BEGIN;

ALTER TABLE spell_templates 
  DROP COLUMN IF EXISTS subtext,
  DROP COLUMN IF EXISTS aura_description,
  DROP COLUMN IF EXISTS icon_id,
  DROP COLUMN IF EXISTS school_mask,
  DROP COLUMN IF EXISTS power_type,
  DROP COLUMN IF EXISTS mana_cost,
  DROP COLUMN IF EXISTS mana_cost_pct,
  DROP COLUMN IF EXISTS cast_time_index,
  DROP COLUMN IF EXISTS recovery_time,
  DROP COLUMN IF EXISTS range_index,
  DROP COLUMN IF EXISTS attributes,
  DROP COLUMN IF EXISTS targets;

COMMIT;
