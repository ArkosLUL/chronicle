BEGIN;

INSERT INTO wow_servers (id, name) VALUES
  ('9750514d-be08-4700-bce7-4108916b7ea0', 'asia-turtle-wow')
;

INSERT INTO wow_server_realms (id, server_id, name) VALUES
  ('c240e1e4-9d2b-46f7-b23c-6b55a37b4710', '9750514d-be08-4700-bce7-4108916b7ea0', 'Gehennas'),
  ('5f786828-1c60-4360-8b0f-14b7b494be3a', '9750514d-be08-4700-bce7-4108916b7ea0', 'Blood Ring'),
  ('885cd224-aa71-4592-81e2-98fe138ca650', '9750514d-be08-4700-bce7-4108916b7ea0', 'Ravenstorm'),
  ('0f9825e5-8a88-4bfb-80f6-26b472c7a1aa', '9750514d-be08-4700-bce7-4108916b7ea0', 'Karazhan')
;

COMMIT;