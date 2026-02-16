-- name: UpsertSpellTemplate :exec
INSERT INTO spell_templates (
    id, name, school, description, subtext, aura_description,
    icon_id, school_mask, power_type, mana_cost, mana_cost_pct,
    cast_time_index, recovery_time, range_index, attributes, targets,
    created_at, updated_at
)
VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10, $11,
    $12, $13, $14, $15, $16,
    NOW(), NOW()
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    school = EXCLUDED.school,
    description = EXCLUDED.description,
    subtext = EXCLUDED.subtext,
    aura_description = EXCLUDED.aura_description,
    icon_id = EXCLUDED.icon_id,
    school_mask = EXCLUDED.school_mask,
    power_type = EXCLUDED.power_type,
    mana_cost = EXCLUDED.mana_cost,
    mana_cost_pct = EXCLUDED.mana_cost_pct,
    cast_time_index = EXCLUDED.cast_time_index,
    recovery_time = EXCLUDED.recovery_time,
    range_index = EXCLUDED.range_index,
    attributes = EXCLUDED.attributes,
    targets = EXCLUDED.targets,
    updated_at = NOW();

-- name: GetSpellTemplate :one
SELECT * FROM spell_templates WHERE id = $1;

-- name: GetSpellTemplatesByIDs :many
SELECT * FROM spell_templates WHERE id = ANY($1::int[]);

-- name: SpellTemplateCount :one
SELECT COUNT(*) FROM spell_templates;

-- name: DeleteAllSpellTemplates :exec
DELETE FROM spell_templates;
