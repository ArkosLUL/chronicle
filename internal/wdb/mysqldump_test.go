package wdb

import (
	"strings"
	"testing"
)

func TestParseCreatureTemplateSQL(t *testing.T) {
	t.Parallel()

	// Sample from AzerothCore database-wotlk creature_template.sql
	input := `/*!40101 SET @saved_cs_client     = @@character_set_client */;
INSERT INTO ` + "`creature_template`" + ` VALUES (1,0,0,0,0,0,10045,0,0,0,'Waypoint (Only GM can see it)','Visual',NULL,0,1,80,0,35,0,0.91,1.14286,1,0,422,586,0,642,1,2000,2200,1,0,2048,0,0,0,0,0,0,345,509,103,8,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,'',0,4,1,0.0125,1,1,0,0,0,0,0,0,0,0,1,0,130,'',1),(6,0,0,0,0,0,10913,0,0,0,'Kobold Vermin','',NULL,0,1,2,0,25,0,1,0.85714,1,0,2,2,0,26,1,2000,2000,1,0,2048,0,0,0,0,0,0,1,1,0,7,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,4,'SmartAI',1,3,1,1,1,1,0,0,0,0,0,0,0,100,1,0,2,'',12340);
`

	creatures, err := ParseCreatureTemplateSQL(strings.NewReader(input))
	if err != nil {
		t.Fatal(err)
	}

	if len(creatures) != 2 {
		t.Fatalf("expected 2 creatures, got %d", len(creatures))
	}

	// Verify first creature
	c := creatures[0]
	if c.Entry != 1 {
		t.Errorf("entry: got %d, want 1", c.Entry)
	}
	if c.Name != "Waypoint (Only GM can see it)" {
		t.Errorf("name: got %q, want %q", c.Name, "Waypoint (Only GM can see it)")
	}
	if !c.Subname.Valid || c.Subname.String != "Visual" {
		t.Errorf("subname: got %v, want 'Visual'", c.Subname)
	}
	if c.DisplayId1 != 10045 {
		t.Errorf("display_id1: got %d, want 10045", c.DisplayId1)
	}
	if c.LevelMin != 1 {
		t.Errorf("level_min: got %d, want 1", c.LevelMin)
	}
	if c.LevelMax != 80 {
		t.Errorf("level_max: got %d, want 80", c.LevelMax)
	}
	if c.DmgMin != 422 {
		t.Errorf("dmg_min: got %v, want 422", c.DmgMin)
	}
	if c.AttackPower != 642 {
		t.Errorf("attack_power: got %d, want 642", c.AttackPower)
	}
	if c.BaseAttackTime != 2000 {
		t.Errorf("base_attack_time: got %d, want 2000", c.BaseAttackTime)
	}
	if c.UnitClass != 1 {
		t.Errorf("unit_class: got %d, want 1", c.UnitClass)
	}

	// Verify second creature
	c2 := creatures[1]
	if c2.Entry != 6 {
		t.Errorf("entry: got %d, want 6", c2.Entry)
	}
	if c2.Name != "Kobold Vermin" {
		t.Errorf("name: got %q, want %q", c2.Name, "Kobold Vermin")
	}
	if !c2.Subname.Valid || c2.Subname.String != "" {
		t.Errorf("subname: got %v, want empty string (valid)", c2.Subname)
	}
	if c2.DisplayId1 != 10913 {
		t.Errorf("display_id1: got %d, want 10913", c2.DisplayId1)
	}
}

func TestParseCreatureTemplateSQLMultiLine(t *testing.T) {
	t.Parallel()

	// Real format: INSERT on one line, rows on subsequent lines, ending with ;
	input := `LOCK TABLES ` + "`creature_template`" + ` WRITE;
INSERT INTO ` + "`creature_template`" + ` VALUES 
(1,0,0,0,0,0,10045,0,0,0,'Waypoint (Only GM can see it)','Visual',NULL,0,1,80,0,35,0,0.91,1.14286,1,0,422,586,0,642,1,2000,2200,1,0,2048,0,0,0,0,0,0,345,509,103,8,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,'',0,4,1,0.0125,1,1,0,0,0,0,0,0,0,0,1,0,130,'',1),
(6,0,0,0,0,0,10913,0,0,0,'Kobold Vermin','',NULL,0,1,2,0,25,0,1,0.85714,1,0,2,2,0,26,1,2000,2000,1,0,2048,0,0,0,0,0,0,1,1,0,7,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,4,'SmartAI',1,3,1,1,1,1,0,0,0,0,0,0,0,100,1,0,2,'',12340);
`

	creatures, err := ParseCreatureTemplateSQL(strings.NewReader(input))
	if err != nil {
		t.Fatal(err)
	}

	if len(creatures) != 2 {
		t.Fatalf("expected 2 creatures, got %d", len(creatures))
	}
	if creatures[0].Entry != 1 {
		t.Errorf("first entry: got %d, want 1", creatures[0].Entry)
	}
	if creatures[1].Entry != 6 {
		t.Errorf("second entry: got %d, want 6", creatures[1].Entry)
	}
	if creatures[1].Name != "Kobold Vermin" {
		t.Errorf("second name: got %q, want %q", creatures[1].Name, "Kobold Vermin")
	}
}

func TestParseItemTemplateSQL(t *testing.T) {
	t.Parallel()

	input := `INSERT INTO ` + "`item_template`" + ` VALUES 
(25,2,7,-1,'Worn Shortsword',1542,1,0,0,1,36,7,21,-1,-1,2,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,0,0,0,0,0,0,0,0,0,0,0,1900,0,0,0,0,0,0,-1,0,-1,0,0,0,0,-1,0,-1,0,0,0,0,-1,0,-1,0,0,0,0,-1,0,-1,0,0,0,0,-1,0,-1,0,'',0,1,0,0,0,1,3,0,0,0,0,20,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,'',0,0,0,0,0,12340),
(38,4,0,-1,'Recruit\'s Shirt',9891,1,0,0,1,1,1,4,-1,-1,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,-1,0,0,0,0,-1,0,-1,0,0,0,0,-1,0,-1,0,0,0,0,-1,0,-1,0,0,0,0,-1,0,-1,0,'',0,0,0,0,0,7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,'',0,0,0,0,0,12340);
`

	items, err := ParseItemTemplateSQL(strings.NewReader(input))
	if err != nil {
		t.Fatal(err)
	}

	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}

	it := items[0]
	if it.Entry != 25 {
		t.Errorf("entry: got %d, want 25", it.Entry)
	}
	if it.Name != "Worn Shortsword" {
		t.Errorf("name: got %q, want %q", it.Name, "Worn Shortsword")
	}
	if it.Class != 2 {
		t.Errorf("class: got %d, want 2", it.Class)
	}
	if it.Subclass != 7 {
		t.Errorf("subclass: got %d, want 7", it.Subclass)
	}
	if it.Quality != 1 {
		t.Errorf("quality: got %d, want 1", it.Quality)
	}
	if it.DmgMin1 != 1 || it.DmgMax1 != 3 {
		t.Errorf("dmg: got %v-%v, want 1-3", it.DmgMin1, it.DmgMax1)
	}
	if it.Delay != 1900 {
		t.Errorf("delay: got %d, want 1900", it.Delay)
	}
	if it.MaxDurability != 20 {
		t.Errorf("max_durability: got %d, want 20", it.MaxDurability)
	}
	if it.Bonding != 0 {
		t.Errorf("bonding: got %d, want 0", it.Bonding)
	}

	// Second item has escaped quote in name
	it2 := items[1]
	if it2.Name != "Recruit's Shirt" {
		t.Errorf("name: got %q, want %q", it2.Name, "Recruit's Shirt")
	}
}

func TestParseCreatureTemplateSQLNullSubname(t *testing.T) {
	t.Parallel()

	input := `INSERT INTO ` + "`creature_template`" + ` VALUES (3,0,0,0,0,0,987,0,0,0,'Flesh Eater','',NULL,0,24,25,0,21,0,0.777776,1.14286,1,0,35,48,0,86,1,2000,2000,1,0,2048,0,0,0,0,0,0,24,36,6,6,0,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,32,47,'',1,3,1,1.02,1,1,0,884,1129,0,0,0,0,0,1,8388624,0,'',12340);`

	creatures, err := ParseCreatureTemplateSQL(strings.NewReader(input))
	if err != nil {
		t.Fatal(err)
	}

	if len(creatures) != 1 {
		t.Fatalf("expected 1 creature, got %d", len(creatures))
	}

	c := creatures[0]
	if c.Entry != 3 {
		t.Errorf("entry: got %d, want 3", c.Entry)
	}
	// subname is '' (empty string), not NULL — NULL is the IconName field
	if !c.Subname.Valid || c.Subname.String != "" {
		t.Errorf("subname: got %v, want empty valid string", c.Subname)
	}
	if c.MechanicImmuneMask != 8388624 {
		t.Errorf("mechanic_immune_mask: got %d, want 8388624", c.MechanicImmuneMask)
	}
}
func TestParseItemTemplateSQLClassicFormat(t *testing.T) {
	t.Parallel()

	// Classic format uses explicit column names in the INSERT statement.
	input := "INSERT INTO `item_template` (`entry`, `class`, `subclass`, `name`, `displayid`, `Quality`, `Flags`, `BuyCount`, `BuyPrice`, `SellPrice`, `InventoryType`, `AllowableClass`, `AllowableRace`, `ItemLevel`, `RequiredLevel`, `RequiredSkill`, `RequiredSkillRank`, `requiredspell`, `requiredhonorrank`, `RequiredCityRank`, `RequiredReputationFaction`, `RequiredReputationRank`, `maxcount`, `stackable`, `ContainerSlots`, `stat_type1`, `stat_value1`, `stat_type2`, `stat_value2`, `stat_type3`, `stat_value3`, `stat_type4`, `stat_value4`, `stat_type5`, `stat_value5`, `stat_type6`, `stat_value6`, `stat_type7`, `stat_value7`, `stat_type8`, `stat_value8`, `stat_type9`, `stat_value9`, `stat_type10`, `stat_value10`, `dmg_min1`, `dmg_max1`, `dmg_type1`, `dmg_min2`, `dmg_max2`, `dmg_type2`, `dmg_min3`, `dmg_max3`, `dmg_type3`, `dmg_min4`, `dmg_max4`, `dmg_type4`, `dmg_min5`, `dmg_max5`, `dmg_type5`, `armor`, `holy_res`, `fire_res`, `nature_res`, `frost_res`, `shadow_res`, `arcane_res`, `delay`, `ammo_type`, `RangedModRange`, `spellid_1`, `spelltrigger_1`, `spellcharges_1`, `spellppmRate_1`, `spellcooldown_1`, `spellcategory_1`, `spellcategorycooldown_1`, `spellid_2`, `spelltrigger_2`, `spellcharges_2`, `spellppmRate_2`, `spellcooldown_2`, `spellcategory_2`, `spellcategorycooldown_2`, `spellid_3`, `spelltrigger_3`, `spellcharges_3`, `spellppmRate_3`, `spellcooldown_3`, `spellcategory_3`, `spellcategorycooldown_3`, `spellid_4`, `spelltrigger_4`, `spellcharges_4`, `spellppmRate_4`, `spellcooldown_4`, `spellcategory_4`, `spellcategorycooldown_4`, `spellid_5`, `spelltrigger_5`, `spellcharges_5`, `spellppmRate_5`, `spellcooldown_5`, `spellcategory_5`, `spellcategorycooldown_5`, `bonding`, `description`, `PageText`, `LanguageID`, `PageMaterial`, `startquest`, `lockid`, `Material`, `sheath`, `RandomProperty`, `block`, `itemset`, `MaxDurability`, `area`, `Map`, `BagFamily`, `DisenchantID`, `FoodType`, `minMoneyLoot`, `maxMoneyLoot`, `Duration`, `ExtraFlags`) VALUES \n" +
		"(25,2,7,'Worn Shortsword',1542,1,0,1,35,7,21,-1,-1,2,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1900,0,0,0,0,0,0,-1,0,-1,0,0,0,0,-1,0,-1,0,0,0,0,-1,0,-1,0,0,0,0,-1,0,-1,0,0,0,0,0,0,0,0,'',0,1,0,0,0,1,3,0,0,0,20,0,0,0,0,0,0,0,0,0);\n"

	items, err := ParseItemTemplateSQL(strings.NewReader(input))
	if err != nil {
		t.Fatal(err)
	}

	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}

	it := items[0]
	if it.Entry != 25 {
		t.Errorf("entry: got %d, want 25", it.Entry)
	}
	if it.Name != "Worn Shortsword" {
		t.Errorf("name: got %q, want %q", it.Name, "Worn Shortsword")
	}
	if it.Class != 2 {
		t.Errorf("class: got %d, want 2", it.Class)
	}
	if it.Subclass != 7 {
		t.Errorf("subclass: got %d, want 7", it.Subclass)
	}
	if it.Quality != 1 {
		t.Errorf("quality: got %d, want 1", it.Quality)
	}
	if it.DmgMin1 != 1 || it.DmgMax1 != 3 {
		t.Errorf("dmg: got %v-%v, want 1-3", it.DmgMin1, it.DmgMax1)
	}
	if it.Delay != 1900 {
		t.Errorf("delay: got %d, want 1900", it.Delay)
	}
	if it.MaxDurability != 20 {
		t.Errorf("max_durability: got %d, want 20", it.MaxDurability)
	}
}

