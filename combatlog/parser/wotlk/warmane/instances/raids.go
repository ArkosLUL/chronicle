package instances

import (
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/instances"
)

// VoAHostiles returns creature entry IDs for Vault of Archavon (map 4603).
// Includes both 10-man and 25-man NPC IDs where they differ.
func VoAHostiles() map[uint32]instances.Identity {
	hostile := make(map[uint32]instances.Identity)
	instances.LoadAdds(hostile, map[uint32]string{
		// Trash — 10-man
		32353: "Archavon Warder",
		33998: "Tempest Minion",
		34015: "Tempest Warder",
		35143: "Flame Warder",
		38482: "Frost Warder",
		// Trash — 25-man (separate entry IDs)
		32368: "Archavon Warder",
		34200: "Tempest Minion",
		34016: "Tempest Warder",
		35359: "Flame Warder",
		38483: "Frost Warder",
	})
	instances.LoadBosses(hostile, map[uint32]string{
		// 10-man bosses
		31125: "Archavon the Stone Watcher",
		33993: "Emalon the Storm Watcher",
		35013: "Koralon the Flame Watcher",
		38433: "Toravon the Ice Watcher",
		// 25-man bosses (separate entry IDs)
		31722: "Archavon the Stone Watcher",
		33994: "Emalon the Storm Watcher",
		38462: "Toravon the Ice Watcher",
	})
	return hostile
}

var VoAFactory = &instances.CommonFactory{
	Name:      "Vault of Archavon",
	ZoneNames: []string{"vault of archavon"},
	Hostiles:  instances.FromMap(VoAHostiles()),
}
// ObsidianSanctumHostiles returns creature entry IDs for The Obsidian Sanctum (zone 4493).
// Single boss (Sartharion) with three optional drake lieutenants.
func ObsidianSanctumHostiles() map[uint32]instances.Identity {
	hostile := make(map[uint32]instances.Identity)
	instances.LoadAdds(hostile, map[uint32]string{
		// Trash
		30680: "Onyx Brood General",
		30681: "Onyx Blaze Mistress",
		30682: "Onyx Flight Captain",
		30453: "Onyx Sanctum Guardian",
		// Encounter adds
		30643: "Lava Blaze",
		31218: "Acolyte of Shadron",
		31219: "Acolyte of Vesperon",
	})
	instances.LoadBosses(hostile, map[uint32]string{
		28860: "Sartharion",
		30449: "Vesperon",
		30451: "Shadron",
		30452: "Tenebron",
	})
	return hostile
}

var ObsidianSanctumFactory = &instances.CommonFactory{
	Name:      "Obsidian Sanctum",
	ZoneNames: []string{"the obsidian sanctum"},
	Hostiles:  instances.FromMap(ObsidianSanctumHostiles()),
}
// NaxxramasHostiles returns creature entry IDs for Naxxramas (WotLK).
// Reuses the Vanilla Naxx hostile list, replacing Highlord Mograine with Baron Rivendare
// for the Four Horsemen encounter.
func NaxxramasHostiles() map[uint32]instances.Identity {
	hostile := instances.NaxxramasHostiles()
	// WotLK replaces Highlord Mograine with Baron Rivendare in the Four Horsemen
	delete(hostile, 16062)
	instances.LoadBosses(hostile, map[uint32]string{
		30549: "Four Horsemen", // Baron Rivendare
	})
	return hostile
}

var NaxxramasFactory = &instances.CommonFactory{
	Name:      "Naxxramas",
	ZoneNames: []string{"naxxramas", "the upper necropolis"},
	Hostiles:  instances.FromMap(NaxxramasHostiles()),
}


