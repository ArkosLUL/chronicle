#!/usr/bin/env bash
# Export world tables from a running AzerothCore MySQL into the JSON layout that
# `chronicle import-world --server=azerothcore` expects.
#
# Output filenames match the target table names, which makes import-world skip
# key fingerprinting and use them directly. JSON keys must equal the Postgres
# column names — importTable substitutes 0/"" for anything it can't find, so a
# missing alias is silent data loss rather than an error.
#
# Usage: scripts/export_azerothcore_world.sh [output-dir]
set -euo pipefail

OUT_DIR="${1:-importdata/world/azerothcore}"
CONTAINER="${AC_DB_CONTAINER:-ac-database}"
DB="${AC_WORLD_DB:-acore_world}"
MYSQL_USER="${AC_DB_USER:-root}"
MYSQL_PASS="${AC_DB_PASS:-password}"

mkdir -p "$OUT_DIR"

# Emits one JSON object per row, then wraps them into an array. Building the
# array in SQL instead would blow past group_concat_max_len on item_template.
#
# The password goes through MYSQL_PWD rather than -p so mysql stays quiet without
# having to redirect stderr, which would also hide query errors.
run_query() {
    docker exec -i -e MYSQL_PWD="$MYSQL_PASS" "$CONTAINER" mysql \
        -u"$MYSQL_USER" --batch --raw --skip-column-names "$DB"
}

export_table() {
    local table="$1" query="$2"
    echo "exporting $table..."
    {
        echo "["
        run_query <<<"$query" | sed '$ ! s/$/,/'
        echo "]"
    } >"$OUT_DIR/$table.json"
    echo "  -> $OUT_DIR/$table.json ($(grep -c . "$OUT_DIR/$table.json") lines)"
}

# AzerothCore stores flag columns as unsigned 32-bit, but the Postgres columns are
# int4. Wrap the high half round to negative so the bit pattern survives — these
# are bitmasks, not magnitudes. The CAST matters: without it MySQL does the
# subtraction in unsigned arithmetic and errors out on underflow.
signed32() { echo "IF($1 > 2147483647, CAST($1 AS SIGNED) - 4294967296, $1)"; }

# 3.3.5a item_template has no dmg entries 3-5 and no wrapped_gift / extra_flags /
# other_team_entry / patch / tooltip_set_id. Omitted keys default to 0 or "".
export_table world_item_template "
SELECT JSON_OBJECT(
  'entry', entry, 'class', class, 'subclass', subclass,
  'name', name, 'description', description, 'display_id', displayid,
  'quality', Quality, 'flags', $(signed32 Flags), 'buy_count', BuyCount,
  'buy_price', BuyPrice, 'sell_price', SellPrice,
  'inventory_type', InventoryType, 'allowable_class', AllowableClass,
  'allowable_race', AllowableRace, 'item_level', ItemLevel,
  'required_level', RequiredLevel, 'required_skill', RequiredSkill,
  'required_skill_rank', RequiredSkillRank, 'required_spell', requiredspell,
  'required_honor_rank', requiredhonorrank, 'required_city_rank', RequiredCityRank,
  'required_reputation_faction', RequiredReputationFaction,
  'required_reputation_rank', RequiredReputationRank,
  'max_count', maxcount, 'stackable', IFNULL(stackable, 0), 'container_slots', ContainerSlots,
  'stat_type1', stat_type1, 'stat_value1', stat_value1,
  'stat_type2', stat_type2, 'stat_value2', stat_value2,
  'stat_type3', stat_type3, 'stat_value3', stat_value3,
  'stat_type4', stat_type4, 'stat_value4', stat_value4,
  'stat_type5', stat_type5, 'stat_value5', stat_value5,
  'stat_type6', stat_type6, 'stat_value6', stat_value6,
  'stat_type7', stat_type7, 'stat_value7', stat_value7,
  'stat_type8', stat_type8, 'stat_value8', stat_value8,
  'stat_type9', stat_type9, 'stat_value9', stat_value9,
  'stat_type10', stat_type10, 'stat_value10', stat_value10,
  'delay', delay, 'range_mod', RangedModRange, 'ammo_type', ammo_type,
  'dmg_min1', dmg_min1, 'dmg_max1', dmg_max1, 'dmg_type1', dmg_type1,
  'dmg_min2', dmg_min2, 'dmg_max2', dmg_max2, 'dmg_type2', dmg_type2,
  'block', block, 'armor', armor,
  -- Resistances and stackable are nullable in AzerothCore but NOT NULL in Postgres.
  'holy_res', IFNULL(holy_res, 0), 'fire_res', IFNULL(fire_res, 0),
  'nature_res', IFNULL(nature_res, 0), 'frost_res', IFNULL(frost_res, 0),
  'shadow_res', IFNULL(shadow_res, 0), 'arcane_res', IFNULL(arcane_res, 0),
  'spellid_1', spellid_1, 'spelltrigger_1', spelltrigger_1,
  'spellcharges_1', spellcharges_1, 'spellppmrate_1', spellppmRate_1,
  'spellcooldown_1', spellcooldown_1, 'spellcategory_1', spellcategory_1,
  'spellcategorycooldown_1', spellcategorycooldown_1,
  'spellid_2', spellid_2, 'spelltrigger_2', spelltrigger_2,
  'spellcharges_2', spellcharges_2, 'spellppmrate_2', spellppmRate_2,
  'spellcooldown_2', spellcooldown_2, 'spellcategory_2', spellcategory_2,
  'spellcategorycooldown_2', spellcategorycooldown_2,
  'spellid_3', spellid_3, 'spelltrigger_3', spelltrigger_3,
  'spellcharges_3', spellcharges_3, 'spellppmrate_3', spellppmRate_3,
  'spellcooldown_3', spellcooldown_3, 'spellcategory_3', spellcategory_3,
  'spellcategorycooldown_3', spellcategorycooldown_3,
  'spellid_4', spellid_4, 'spelltrigger_4', spelltrigger_4,
  'spellcharges_4', spellcharges_4, 'spellppmrate_4', spellppmRate_4,
  'spellcooldown_4', spellcooldown_4, 'spellcategory_4', spellcategory_4,
  'spellcategorycooldown_4', spellcategorycooldown_4,
  'spellid_5', spellid_5, 'spelltrigger_5', spelltrigger_5,
  'spellcharges_5', spellcharges_5, 'spellppmrate_5', spellppmRate_5,
  'spellcooldown_5', spellcooldown_5, 'spellcategory_5', spellcategory_5,
  'spellcategorycooldown_5', spellcategorycooldown_5,
  'bonding', bonding, 'page_text', PageText, 'page_language', LanguageID,
  'page_material', PageMaterial, 'start_quest', startquest, 'lock_id', lockid,
  'material', Material, 'sheath', sheath, 'random_property', RandomProperty,
  'set_id', itemset, 'max_durability', MaxDurability,
  'area_bound', area, 'map_bound', Map, 'duration', duration,
  'bag_family', BagFamily, 'disenchant_id', DisenchantID, 'food_type', FoodType,
  'min_money_loot', minMoneyLoot, 'max_money_loot', maxMoneyLoot,
  'script_name', ScriptName
) FROM item_template ORDER BY entry;
"

# Only name/subname are actually read by the parser (as a fallback when a
# creature isn't named in the log), but the stat columns are cheap to carry.
# Display IDs live in creature_template_model on 3.3.5a; health/mana/armor and
# damage are derived from creature_classlevelstats at runtime, so they stay 0.
export_table world_creature_template "
SELECT JSON_OBJECT(
  'entry', ct.entry, 'name', ct.name, 'subname', IFNULL(ct.subname, ''),
  'level_min', ct.minlevel, 'level_max', ct.maxlevel,
  'dmg_school', ct.dmgschool, 'dmg_multiplier', ct.DamageModifier,
  'base_attack_time', ct.BaseAttackTime, 'ranged_attack_time', ct.RangeAttackTime,
  'unit_class', ct.unit_class, 'unit_flags', $(signed32 ct.unit_flags),
  'display_id1', IFNULL(m0.CreatureDisplayID, 0),
  'display_id2', IFNULL(m1.CreatureDisplayID, 0),
  'display_id3', IFNULL(m2.CreatureDisplayID, 0),
  'display_id4', IFNULL(m3.CreatureDisplayID, 0),
  'holy_res', IFNULL(r1.Resistance, 0), 'fire_res', IFNULL(r2.Resistance, 0),
  'nature_res', IFNULL(r3.Resistance, 0), 'frost_res', IFNULL(r4.Resistance, 0),
  'shadow_res', IFNULL(r5.Resistance, 0), 'arcane_res', IFNULL(r6.Resistance, 0)
)
FROM creature_template ct
LEFT JOIN creature_template_model m0 ON m0.CreatureID = ct.entry AND m0.Idx = 0
LEFT JOIN creature_template_model m1 ON m1.CreatureID = ct.entry AND m1.Idx = 1
LEFT JOIN creature_template_model m2 ON m2.CreatureID = ct.entry AND m2.Idx = 2
LEFT JOIN creature_template_model m3 ON m3.CreatureID = ct.entry AND m3.Idx = 3
LEFT JOIN creature_template_resistance r1 ON r1.CreatureID = ct.entry AND r1.School = 1
LEFT JOIN creature_template_resistance r2 ON r2.CreatureID = ct.entry AND r2.School = 2
LEFT JOIN creature_template_resistance r3 ON r3.CreatureID = ct.entry AND r3.School = 3
LEFT JOIN creature_template_resistance r4 ON r4.CreatureID = ct.entry AND r4.School = 4
LEFT JOIN creature_template_resistance r5 ON r5.CreatureID = ct.entry AND r5.School = 5
LEFT JOIN creature_template_resistance r6 ON r6.CreatureID = ct.entry AND r6.School = 6
ORDER BY ct.entry;
"

export_table world_spell_threat "
SELECT JSON_OBJECT(
  'entry', entry, 'threat', flatMod, 'multiplier', pctMod, 'ap_bonus', apPctMod
) FROM spell_threat ORDER BY entry;
"

echo "done. import with:"
echo "  go run --tags azerothcore ./cmd/chronicle import-world --server=azerothcore \\"
echo "    --db-url=\"postgres://postgres:postgres@127.0.0.1:5433/chronicle?sslmode=disable\""
