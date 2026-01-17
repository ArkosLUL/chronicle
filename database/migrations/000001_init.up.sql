BEGIN;

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
  user_id uuid NOT NULL REFERENCES users(id),

  access_token TEXT NOT NULL,
  access_token_secret TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Unique pairing of linked_id + provider
CREATE UNIQUE INDEX user_auths_unique_linked_id ON user_auth_links(linked_id, provider);

CREATE TABLE wow_log_groups (
    id uuid PRIMARY KEY,
    owner uuid NOT NULL REFERENCES users(id),

    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE TABLE log_file (
  id uuid PRIMARY KEY,
  owner uuid NOT NULL REFERENCES users(id),
  -- Files only exist in the context of a wow log
  wow_log_id uuid NULL REFERENCES wow_log_groups(id)
    ON DELETE CASCADE,

  hash TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,

  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX files_unique_owner_hash ON log_file(owner, hash);

-- Used for sqlc typing
CREATE DOMAIN wow_log_group_files AS jsonb;
CREATE DOMAIN wow_guid AS TEXT
  CHECK (
    VALUE ~ '^0x[0-9A-Fa-f]{16}$'
    )
;


COMMIT;