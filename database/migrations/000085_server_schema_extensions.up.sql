BEGIN;

-- Servers: add created_by, url, description
ALTER TABLE wow_servers
  ADD COLUMN created_by  UUID REFERENCES users(id),
  ADD COLUMN url         TEXT,
  ADD COLUMN description TEXT NOT NULL DEFAULT '';

-- Realms: add created_by, url, description
ALTER TABLE wow_server_realms
  ADD COLUMN created_by   UUID REFERENCES users(id),
  ADD COLUMN url          TEXT,
  ADD COLUMN description  TEXT NOT NULL DEFAULT '';

-- Upload keys: add created_by
ALTER TABLE wow_server_upload_keys
  ADD COLUMN created_by UUID REFERENCES users(id);

COMMIT;
