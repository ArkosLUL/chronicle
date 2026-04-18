package instances

import "github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/instances/rankings"
// SpeedrunRulesByInstance returns speedrun requirements keyed by instance name.
// Only instances with speedrun rules are included.
func SpeedrunRulesByInstance() map[string][]rankings.SpeedrunRequirement {
	return map[string][]rankings.SpeedrunRequirement{
		"Molten Core":    MoltenCoreSpeedrunRequirements(),
		"Blackwing Lair":  BlackwingLairSpeedrunRequirements(),
		"Onyxia's Lair":  OnyxiasLairSpeedrunRequirements(),
	}
}


// MoltenCoreSpeedrunRequirements returns the 10 boss kills required for a
// valid Molten Core speedrun.
func MoltenCoreSpeedrunRequirements() []rankings.SpeedrunRequirement {
	return []rankings.SpeedrunRequirement{
		{Name: "Incindis", EntryIDs: []uint32{52145}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
		{Name: "Lucifron", EntryIDs: []uint32{12118}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
		{Name: "Magmadar", EntryIDs: []uint32{11982}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
		{Name: "Garr", EntryIDs: []uint32{12057}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
		{Name: "Shazzrah", EntryIDs: []uint32{12264}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
		{Name: "Baron Geddon", EntryIDs: []uint32{12056}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
		{Name: "Sulfuron Harbinger", EntryIDs: []uint32{12098}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
		{Name: "Golemagg the Incinerator", EntryIDs: []uint32{11988}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
		{Name: "Basalthar", EntryIDs: []uint32{65020}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
		{Name: "Smoldaris", EntryIDs: []uint32{65021}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
		{Name: "Sorcerer-Thane Thaurissan", EntryIDs: []uint32{57642}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
		{Name: "Majordomo Executus", EntryIDs: []uint32{12018}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
		{Name: "Ragnaros", EntryIDs: []uint32{11502}, Count: 1, Category: rankings.SpeedrunCategoryBosses},

		// Trash Requirements
		{Name: "Firesworn", EntryIDs: []uint32{12099}, Count: 8, Category: rankings.SpeedrunCategoryTrash},
	}
}

// BlackwingLairSpeedrunRequirements returns the boss kills required for a
// valid Blackwing Lair speedrun.
func BlackwingLairSpeedrunRequirements() []rankings.SpeedrunRequirement {
	return []rankings.SpeedrunRequirement{
		{Name: "Razorgore the Untamed", EntryIDs: []uint32{12435}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
		{Name: "Vaelastrasz the Corrupt", EntryIDs: []uint32{13020}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
		{Name: "Broodlord Lashlayer", EntryIDs: []uint32{12017}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
		{Name: "Firemaw", EntryIDs: []uint32{11983}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
    {Name: "Ezzel Darkbrewer", EntryIDs: []uint32{65148}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
    {Name: "Ebonroc", EntryIDs: []uint32{14601}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
    {Name: "Flamegor", EntryIDs: []uint32{11981}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
    {Name: "Chromaggus", EntryIDs: []uint32{14020}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
		{Name: "Nefarian", EntryIDs: []uint32{11583}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
	}
}

// OnyxiasLairSpeedrunRequirements returns the boss kills required for a
// valid Onyxia's Lair speedrun.
func OnyxiasLairSpeedrunRequirements() []rankings.SpeedrunRequirement {
	return []rankings.SpeedrunRequirement{
		{Name: "Onyxia", EntryIDs: []uint32{10184}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
		{Name: "Broodcommander Axelus", EntryIDs: []uint32{49018}, Count: 1, Category: rankings.SpeedrunCategoryBosses},
	}
}
