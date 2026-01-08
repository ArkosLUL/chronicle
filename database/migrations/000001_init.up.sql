BEGIN;

-- Always use the application role from the app
-- DO $$
--   DECLARE
--     schema TEXT := current_schema();
--   BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'application') THEN
--       CREATE ROLE application NOLOGIN;
--       EXECUTE format('GRANT USAGE ON SCHEMA %s TO application', schema);
--       GRANT SELECT, INSERT, UPDATE, DELETE ON users TO application;
--     END IF;
--   END
-- $$ LANGUAGE plpgsql;

-- CREATE OR REPLACE FUNCTION set_actor(actor_id uuid) RETURNS void AS $$
-- BEGIN
--   PERFORM set_config('app.current_actor', actor_id::text, false);
-- END;
-- $$ LANGUAGE plpgsql;

CREATE TABLE users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT NOT NULL,

  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE user_auth_links (
  id uuid PRIMARY KEY,
  linked_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  provider  TEXT NOT NULL,

  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE user_auth_session (
  id uuid PRIMARY KEY,
  user_auth_id uuid NOT NULL REFERENCES user_auth_links(id),

  access_token TEXT NOT NULL,
  access_token_secret TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Unique pairing of linked_id + provider
CREATE INDEX user_auths_unique_linked_id ON user_auth_links(linked_id, provider);

CREATE TABLE files (
  id uuid PRIMARY KEY,
  owner uuid NOT NULL REFERENCES users(id),

  hash TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,

  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE INDEX files_unique_owner_hash ON files(owner, hash);

CREATE TABLE wow_logs (
  id uuid PRIMARY KEY,
  owner uuid NOT NULL REFERENCES users(id),

  first_log_file uuid NOT NULL REFERENCES files(id),
  second_log_file uuid NULL REFERENCES files(id),

  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- RLS example if I decide to use it
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY user_isolation_policy ON users
--   USING (id = current_setting('app.current_actor', true)::uuid);

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
  school spell_school NOT NULL,
  -- TODO: direct_damage, dot, hot, etc. Do we need that here?
--   spell_type TEXT NOT NULL,
  description TEXT NULL,


  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
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
  description TEXT NULL,
  -- TODO: base stats + item stats

  -- TODO: Add 'source' being the game api, the turtle wow db, or items.dbc
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
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