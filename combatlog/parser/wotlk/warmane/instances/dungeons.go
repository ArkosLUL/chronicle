package instances

import (
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/instances"
)

// NexusHostiles returns creature entry IDs for The Nexus dungeon (map 576).
// Bosses: Grand Magus Telestra, Anomalus, Ormorok the Tree-Shaper, Keristrasza.
// Optional boss: Commander Kolurg (Alliance) / Commander Stoutbeard (Horde).
func NexusHostiles() map[uint32]instances.Identity {
	hostile := make(map[uint32]instances.Identity)
	instances.LoadAdds(hostile, map[uint32]string{
		// Trash mobs
		26746: "Crazed Mana-Wraith",
		26727: "Mage Hunter Ascendant",
		26730: "Mage Slayer",
		26792: "Crystalline Protector",
		26793: "Crystalline Frayer",
		28231: "Crystalline Tender",
		26734: "Azure Enforcer",
		26722: "Azure Magus",
		26735: "Azure Scale-Binder",
		26737: "Crazed Mana-Surge",
		26918: "Chaotic Rift",
	})
	instances.LoadBosses(hostile, map[uint32]string{
		26731: "Grand Magus Telestra",
		26763: "Anomalus",
		26794: "Ormorok the Tree-Shaper",
		26723: "Keristrasza",
		26798: "Commander Kolurg",
		26796: "Commander Stoutbeard",
	})
	return hostile
}

var NexusFactory = &instances.CommonFactory{
	Name:      "The Nexus",
	ZoneNames: []string{"the nexus"},
	ZoneName:  instances.ZoneNameMatcher("the nexus"),
	Hostiles:  instances.FromMap(NexusHostiles()),
}
