package smcathedral

import "github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters"

func CathedralHostiles() map[uint32]encounters.Identity {
	hostile := make(map[uint32]encounters.Identity)
	for k, _ := range map[uint32]string{
		4540: "Scarlet Monk",
		4299: "Scarlet Chaplain",
		4301: "Scarlet Centurion",
		4302: "Scarlet Champion",
		4300: "Scarlet Wizard",
		3976: "Scarlet Commander Mograine",
		3977: "High Inquisitor Whitemane",
		4542: "High Inquisitor Fairbanks",
		4295: "Scarlet Myrmidon",

		4298: "Scarlet Defender", // Is this in the instance?
	} {
		hostile[k] = encounters.Identity{Hostile: true}
	}
	return hostile
}
