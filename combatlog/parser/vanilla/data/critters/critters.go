package critters

import "github.com/Emyrk/chronicle/combatlog/parser/guid"

var critters = map[uint32]string{
	4075:  "Rat",
	7395:  "Cockroach",
	4076:  "Roach",
	2914:  "Snake",
	883:   "Deer",
	1420:  "Toad",
	16030: "Maggot",
}

func IsCritter(id guid.GUID) bool {
	if !id.IsCreature() {
		return false
	}

	entry, ok := id.GetEntry()
	if !ok {
		return false
	}

	_, exists := critters[entry]
	return exists
}
