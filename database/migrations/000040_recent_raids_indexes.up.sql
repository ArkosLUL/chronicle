-- Critical: used in 6+ correlated subqueries per ListRecentInstances result
CREATE INDEX idx_log_instance_encounters_instance_id
  ON log_instance_encounters(instance_id);

-- Critical: COUNT(*) subquery for player_count
CREATE INDEX idx_log_instance_players_instance_id
  ON log_instance_players(instance_id);

-- JOIN optimization: log_instances → parsed_log_group
CREATE INDEX idx_log_instances_log_group_id
  ON log_instances(log_group_id);

-- Filter optimization: realm_id WHERE clause
CREATE INDEX idx_log_instances_realm_id
  ON log_instances(realm_id);
