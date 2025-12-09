BEGIN;

CREATE TYPE spell_school AS ENUM (
  'physical',
  'fire',
  'frost',
  'shadow',
  'arcane',
  'holy',
  'nature'
);

-- Some conventions
--  - "*_templates" is the name of most tables. An item in wow
--    is an instance of a given item template with things such as enchants.


CREATE TABLE spell_templates (
  id INT PRIMARY KEY,
  name TEXT NOT NULL,
  -- TODO: make this an enum
  school TEXT NOT NULL,
  -- TODO: direct_damage, dot, hot, etc. Do we need that here?
--   spell_type TEXT NOT NULL,
  description TEXT NULL
);

CREATE TABLE item_templates (
  id INT PRIMARY KEY,
  name TEXT NOT NULL,
  quality SMALLINT NOT NULL,
  item_level SMALLINT NOT NULL,
  required_level SMALLINT NULL,
  -- TODO: is class a bitmask?
  class SMALLINT NOT NULL,
  sub_class SMALLINT NOT NULL,
  inventory_slot SMALLINT NOT NULL,
  icon TEXT NULL,

  unique_limit SMALLINT NULL,
  -- bop or boe or none
  bind_type SMALLINT NULL,
  stack_size SMALLINT DEFAULT 1,
  -- TODO: Extra flavor text
  description TEXT NULL
  -- TODO: base stats + item stats
);

COMMENT ON TABLE item_templates IS
  'Items without data such as enchants.';

COMMENT ON COLUMN item_templates.id IS
  'Matches the item id in WoW.';

COMMENT ON COLUMN item_templates.quality IS
  '0 grey, 1 white, 2 green, 3 blue, 4 purple, 5 legendary, 6 artifact';

CREATE TYPE item_effect_type AS ENUM (
  'on_use',
  'on_equip',
  'on_hit',
  'proc' -- Is this just on hit?
);

CREATE TABLE item_effects (
  id uuid PRIMARY KEY,
  item_id INT NOT NULL REFERENCES item_templates(id),
  effect_type item_effect_type NOT NULL ,
  -- effect_index is used to order the effects for tooltip consistency
  effect_index SMALLINT NULL,
  spell_id INT NOT NULL REFERENCES spell_templates(id)
  -- TODO: proc chance data in another table?
);

-- TODO: Affix tables

COMMIT;