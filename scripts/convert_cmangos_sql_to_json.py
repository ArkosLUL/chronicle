#!/usr/bin/env python3
"""Convert a cmangos MySQL item_template dump (unmodified.sql) to JSON.

Usage:
    python3 scripts/convert_cmangos_sql_to_json.py /tmp/wotlk-item-db/db/unmodified.sql importdata/world/warmane/world_item_template.json
"""

import json
import re
import sys

# MySQL column name -> our DB column name.
# Columns mapped to None are skipped entirely.
COLUMN_MAP = {
    "entry": "entry",
    "class": "class",
    "subclass": "subclass",
    "unk0": None,
    "name": "name",
    "displayid": "display_id",
    "Quality": "quality",
    "Flags": "flags",
    "Flags2": None,
    "BuyCount": "buy_count",
    "BuyPrice": "buy_price",
    "SellPrice": "sell_price",
    "InventoryType": "inventory_type",
    "AllowableClass": "allowable_class",
    "AllowableRace": "allowable_race",
    "ItemLevel": "item_level",
    "RequiredLevel": "required_level",
    "RequiredSkill": "required_skill",
    "RequiredSkillRank": "required_skill_rank",
    "requiredspell": "required_spell",
    "requiredhonorrank": "required_honor_rank",
    "RequiredCityRank": "required_city_rank",
    "RequiredReputationFaction": "required_reputation_faction",
    "RequiredReputationRank": "required_reputation_rank",
    "maxcount": "max_count",
    "stackable": "stackable",
    "ContainerSlots": "container_slots",
    "StatsCount": None,
    "stat_type1": "stat_type1",
    "stat_value1": "stat_value1",
    "stat_type2": "stat_type2",
    "stat_value2": "stat_value2",
    "stat_type3": "stat_type3",
    "stat_value3": "stat_value3",
    "stat_type4": "stat_type4",
    "stat_value4": "stat_value4",
    "stat_type5": "stat_type5",
    "stat_value5": "stat_value5",
    "stat_type6": "stat_type6",
    "stat_value6": "stat_value6",
    "stat_type7": "stat_type7",
    "stat_value7": "stat_value7",
    "stat_type8": "stat_type8",
    "stat_value8": "stat_value8",
    "stat_type9": "stat_type9",
    "stat_value9": "stat_value9",
    "stat_type10": "stat_type10",
    "stat_value10": "stat_value10",
    "ScalingStatDistribution": None,
    "ScalingStatValue": None,
    "dmg_min1": "dmg_min1",
    "dmg_max1": "dmg_max1",
    "dmg_type1": "dmg_type1",
    "dmg_min2": "dmg_min2",
    "dmg_max2": "dmg_max2",
    "dmg_type2": "dmg_type2",
    "armor": "armor",
    "holy_res": "holy_res",
    "fire_res": "fire_res",
    "nature_res": "nature_res",
    "frost_res": "frost_res",
    "shadow_res": "shadow_res",
    "arcane_res": "arcane_res",
    "delay": "delay",
    "ammo_type": "ammo_type",
    "RangedModRange": "range_mod",
    "spellid_1": "spellid_1",
    "spelltrigger_1": "spelltrigger_1",
    "spellcharges_1": "spellcharges_1",
    "spellppmRate_1": "spellppmrate_1",
    "spellcooldown_1": "spellcooldown_1",
    "spellcategory_1": "spellcategory_1",
    "spellcategorycooldown_1": "spellcategorycooldown_1",
    "spellid_2": "spellid_2",
    "spelltrigger_2": "spelltrigger_2",
    "spellcharges_2": "spellcharges_2",
    "spellppmRate_2": "spellppmrate_2",
    "spellcooldown_2": "spellcooldown_2",
    "spellcategory_2": "spellcategory_2",
    "spellcategorycooldown_2": "spellcategorycooldown_2",
    "spellid_3": "spellid_3",
    "spelltrigger_3": "spelltrigger_3",
    "spellcharges_3": "spellcharges_3",
    "spellppmRate_3": "spellppmrate_3",
    "spellcooldown_3": "spellcooldown_3",
    "spellcategory_3": "spellcategory_3",
    "spellcategorycooldown_3": "spellcategorycooldown_3",
    "spellid_4": "spellid_4",
    "spelltrigger_4": "spelltrigger_4",
    "spellcharges_4": "spellcharges_4",
    "spellppmRate_4": "spellppmrate_4",
    "spellcooldown_4": "spellcooldown_4",
    "spellcategory_4": "spellcategory_4",
    "spellcategorycooldown_4": "spellcategorycooldown_4",
    "spellid_5": "spellid_5",
    "spelltrigger_5": "spelltrigger_5",
    "spellcharges_5": "spellcharges_5",
    "spellppmRate_5": "spellppmrate_5",
    "spellcooldown_5": "spellcooldown_5",
    "spellcategory_5": "spellcategory_5",
    "spellcategorycooldown_5": "spellcategorycooldown_5",
    "bonding": "bonding",
    "description": "description",
    "PageText": "page_text",
    "LanguageID": "page_language",
    "PageMaterial": "page_material",
    "startquest": "start_quest",
    "lockid": "lock_id",
    "Material": "material",
    "sheath": "sheath",
    "RandomProperty": "random_property",
    "RandomSuffix": None,
    "block": "block",
    "itemset": "set_id",
    "MaxDurability": "max_durability",
    "area": "area_bound",
    "Map": "map_bound",
    "BagFamily": "bag_family",
    "TotemCategory": None,
    "socketColor_1": None,
    "socketContent_1": None,
    "socketColor_2": None,
    "socketContent_2": None,
    "socketColor_3": None,
    "socketContent_3": None,
    "socketBonus": None,
    "GemProperties": None,
    "RequiredDisenchantSkill": None,
    "ArmorDamageModifier": None,
    "Duration": "duration",
    "ItemLimitCategory": None,
    "HolidayId": None,
    "ScriptName": "script_name",
    "DisenchantID": "disenchant_id",
    "FoodType": "food_type",
    "minMoneyLoot": "min_money_loot",
    "maxMoneyLoot": "max_money_loot",
    "ExtraFlags": "extra_flags",
}


def parse_value(s: str, pos: int) -> tuple:
    """Parse a single MySQL value starting at pos. Returns (value, new_pos)."""
    if s[pos] == "'":
        # String value - find closing quote, handling escapes
        end = pos + 1
        while end < len(s):
            if s[end] == "\\":
                end += 2
                continue
            if s[end] == "'":
                raw = s[pos + 1 : end]
                # Unescape MySQL string escapes
                raw = raw.replace("\\'", "'").replace("\\\\", "\\")
                return raw, end + 1
            end += 1
        raise ValueError(f"Unterminated string at position {pos}")
    else:
        # Numeric or NULL
        end = pos
        while end < len(s) and s[end] not in (",", ")"):
            end += 1
        token = s[pos:end]
        if token == "NULL":
            return None, end
        # Try int first, then float
        try:
            return int(token), end
        except ValueError:
            return float(token), end


def parse_row(s: str, pos: int) -> tuple:
    """Parse a single (v1,v2,...) tuple. Returns (list_of_values, new_pos)."""
    assert s[pos] == "(", f"Expected '(' at {pos}, got '{s[pos]}'"
    pos += 1
    values = []
    while True:
        val, pos = parse_value(s, pos)
        values.append(val)
        if s[pos] == ",":
            pos += 1
        elif s[pos] == ")":
            return values, pos + 1
        else:
            raise ValueError(f"Unexpected char '{s[pos]}' at {pos}")


def parse_insert(sql: str) -> tuple:
    """Parse all INSERT INTO `items`(col,...) values (...),(...); statements.
    Returns (column_names, list_of_row_tuples).
    """
    columns = None
    all_rows = []

    for m in re.finditer(
        r"insert\s+into\s+`items`\s*\(([^)]+)\)\s*values\s*",
        sql,
        re.IGNORECASE,
    ):
        cols = [c.strip().strip("`") for c in m.group(1).split(",")]
        if columns is None:
            columns = cols
        pos = m.end()

        while pos < len(sql):
            if sql[pos] == "(":
                values, pos = parse_row(sql, pos)
                all_rows.append(values)
                if pos < len(sql) and sql[pos] == ",":
                    pos += 1
                elif pos < len(sql) and sql[pos] == ";":
                    break
            else:
                break

    if columns is None:
        return None, None
    return columns, all_rows


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <input.sql> <output.json>", file=sys.stderr)
        sys.exit(1)

    input_path, output_path = sys.argv[1], sys.argv[2]

    with open(input_path, "r", encoding="utf-8") as f:
        sql = f.read()

    columns, rows = parse_insert(sql)
    if columns is None:
        print("No INSERT INTO `items` statement found", file=sys.stderr)
        sys.exit(1)

    print(f"Parsed {len(rows)} rows with {len(columns)} columns", file=sys.stderr)

    # Build JSON objects with column remapping
    items = []
    for row in rows:
        obj = {}
        for i, col in enumerate(columns):
            mapped = COLUMN_MAP.get(col)
            if mapped is None:
                continue  # Skip unmapped columns
            val = row[i] if i < len(row) else 0
            obj[mapped] = val
        items.append(obj)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(items, f, separators=(",", ":"))

    print(f"Wrote {len(items)} items to {output_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
