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
	ZoneName:  instances.ZoneNameMatcher("vault of archavon"),
	Hostiles:  instances.FromMap(VoAHostiles()),
}
