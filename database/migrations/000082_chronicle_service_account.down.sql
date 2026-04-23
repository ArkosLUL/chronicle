DELETE FROM data_grants
WHERE user_id = '8e3cd4a1-a9f6-4190-8de5-ef037e534981'
  AND source = 'service';

DELETE FROM users WHERE id = '8e3cd4a1-a9f6-4190-8de5-ef037e534981';
