package instances

import "github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/instances"

// MagtheridonsLairHostiles returns creature entry IDs for Magtheridon's Lair (map 544).
func MagtheridonsLairHostiles() map[uint32]instances.Identity {
	hostile := make(map[uint32]instances.Identity)
	instances.LoadAdds(hostile, map[uint32]string{
		18829: "Hellfire Warder",
		17256: "Hellfire Channeler",
	})
	instances.LoadBosses(hostile, map[uint32]string{
		17257: "Magtheridon",
	})
	return hostile
}

var MagtheridonsLairFactory = &instances.CommonFactory{
	Name:      "Magtheridon's Lair",
	ZoneNames: []string{"magtheridon's lair"},
	MapIDs:    []uint32{544},
	Hostiles:  instances.FromMap(MagtheridonsLairHostiles()),
}

func BloodFurnaceHostiles() map[uint32]instances.Identity {
	hostile := make(map[uint32]instances.Identity)
	instances.LoadAdds(hostile, map[uint32]string{
		17370: "Laughing Skull Enforcer",
		17371: "Shadowmoon Warlock",
		17395: "Shadowmoon Summoner",
		17397: "Shadowmoon Adept",
		17398: "Nascent Fel Orc",
		17399: "Seductress",
		17400: "Felguard Annihilator",
		17401: "Felhound Manastalker",
		17414: "Shadowmoon Technician",
		17477: "Hellfire Imp",
		17491: "Laughing Skull Rogue",
		17624: "Laughing Skull Warden",
		17626: "Laughing Skull Legionnaire",
		17653: "Shadowmoon Channeler",
		17662: "Broggok Poison Cloud",
		18894: "Felguard Brute",
	})
	instances.LoadBosses(hostile, map[uint32]string{
		17380: "Broggok",
		17377: "Keli'dan the Breaker",
		17381: "The Maker",
	})
	return hostile
}

var BloodFurnaceFactory = &instances.CommonFactory{
	Name:      "Blood Furnace",
	ZoneNames: []string{"hellfire citadel: the blood furnace"},
	MapIDs:    []uint32{576},
	Hostiles:  instances.FromMap(BloodFurnaceHostiles()),
}
