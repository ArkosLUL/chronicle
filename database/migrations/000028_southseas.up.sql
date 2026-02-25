BEGIN;

INSERT INTO wow_servers (id, name) VALUES
  ('eaa7e20e-ae86-4690-98e0-dde0b9f06cd0', 'sa-turtle-wow')
;

INSERT INTO wow_server_realms (id, server_id, name) VALUES
  ('ad486d39-31dd-4eb6-a43d-7d469df4ffcf', 'eaa7e20e-ae86-4690-98e0-dde0b9f06cd0', 'South Seas')
;

COMMIT;