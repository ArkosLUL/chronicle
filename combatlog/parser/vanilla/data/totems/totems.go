package totems

import (
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
)

type Totem struct {
	ID             uint32
	Name           string
	NormalDuration time.Duration
	// Totemic Mastery indicates the totem can benefit from the Totemic Mastery
	// talent. This affects the duration of the totem.
	TotemicMastery bool
}

func IsTotem(id guid.GUID) (Totem, bool) {
	if id.IsPlayer() {
		return Totem{}, false
	}
	entry, ok := id.GetEntry()
	if !ok {
		return Totem{}, false
	}
	totem, exists := totems[entry]
	return totem, exists
}

var totems = make(map[uint32]Totem)

func init() {
	register("Fire Nova Totem", false,
		variant{id: 5879, duration: 5 * time.Second},
		variant{id: 6110, duration: 5 * time.Second},
		variant{id: 6111, duration: 5 * time.Second},
		variant{id: 7844, duration: 5 * time.Second},
		variant{id: 7845, duration: 5 * time.Second},
	)

	register("Fire Resistance Totem", true,
		variant{id: 5927, duration: 120 * time.Second},
		variant{id: 7424, duration: 120 * time.Second},
		variant{id: 7425, duration: 120 * time.Second},
	)

	register("Mana Spring Totem", true,
		variant{id: 3573, duration: 60 * time.Second},
		variant{id: 7414, duration: 60 * time.Second},
		variant{id: 7415, duration: 60 * time.Second},
		variant{id: 7416, duration: 60 * time.Second},
		variant{id: 0000, duration: 60 * time.Second},
	)

	// Comes from "Enamored Water Spirit" item
	// https://database.turtle-wow.org/?item=20503
	register("Ancient Mana Spring Totem", false,
		variant{id: 15304, duration: 24 * time.Second},
	)

	// BWL has corrupted variants
	register("Corrupted", false,
		// TODO: Idk the durations of these, or how they work.
		variant{nameOverride: "Corrupted Fire Nova Totem", id: 14662, duration: 0},
		variant{nameOverride: "Corrupted Healing Stream Totem", id: 14664, duration: 0},
		variant{nameOverride: "Corrupted Stoneskin Totem", id: 14663, duration: 0},
		variant{nameOverride: "Corrupted Totem", id: 14667, duration: 0},
		variant{nameOverride: "Corrupted Windfury Totem", id: 14666, duration: 0},
	)
}

// Variants are like different ranks for example
type variant struct {
	nameOverride string
	id           uint32
	duration     time.Duration
	spellID      uint32
}

func register(name string, totMast bool, variants ...variant) {
	for _, v := range variants {
		actualName := name
		if v.nameOverride != "" {
			actualName = v.nameOverride
		}
		totems[v.id] = Totem{
			ID:             v.id,
			Name:           actualName,
			NormalDuration: v.duration,
			TotemicMastery: totMast,
		}
	}
}
