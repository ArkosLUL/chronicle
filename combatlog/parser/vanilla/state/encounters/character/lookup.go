package character

import (
	"fmt"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/types/unitinfo"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/unitdb"
)

type characterFactory func(id guid.GUID, chars *Characters) (Character, bool)

var characterFactories = []characterFactory{
	// Global
	NewTotemCharacter,
	NewCritterCharacter,
	// Molten Core
	NewCoreHoundCharacter,
	NewMajordomoPartyCharacter,
	NewIncindisCharacter,
	NewSulfuronHarbingerCharacter,
	NewSmoldarisBasaltharCharacter,
	NewSorcererThaneCharacter,
	NewRagnarosCharacter,
	// Onyxia
	NewOnyxiaCharacter,
	// Zul'Gurub
	NewHighPriestArlokk,
	NewHighPriestMarli,
	NewHighPriestessJeklik,
	NewHighPriestThekalParty,
}

type Characters struct {
	All *OrdererCharacters
	// ByEntry only works on creatures
	ByEntry map[uint32][]Character
	db      *unitdb.Units

	// active is a quick lookup for active characters
	active map[guid.GUID]struct{}
}

func NewCharacters(db *unitdb.Units) *Characters {
	return &Characters{
		db:      db,
		All:     NewOrdererCharacters(),
		ByEntry: make(map[uint32][]Character),
		active:  make(map[guid.GUID]struct{}),
	}
}

func (c Characters) AddAll(ids ...guid.GUID) bool {
	change := false
	for _, id := range ids {
		if _, changed := c.Add(id); changed {
			change = true
		}
	}
	return change
}

func (c Characters) Get(id guid.GUID) (Character, bool) {
	char, exists := c.All.Get(id)
	return char, exists
}

func (c Characters) GetInfo(id guid.GUID) (unitinfo.Info, bool) {
	return c.db.Get(id)
}

func (c Characters) Add(id guid.GUID) (_ Character, newChar bool) {
	char, exists := c.All.Get(id)
	if !exists {
		newChar = true
		for _, factory := range characterFactories {
			if specialChar, ok := factory(id, &c); ok {
				char = specialChar
				break
			}
		}

		if char == nil {
			// Just assume they are a normal character then
			char = NewCommonCharacter(id, &c)
		}

		c.All.Add(char)
		if id.IsAnyCreature() {
			if entry, ok := id.GetEntry(); ok {
				c.ByEntry[entry] = append(c.ByEntry[entry], char)
			}
		}
	}

	c.trackActive(char)
	return char, newChar
}

// TODO: Maybe a "synthetic" boolean should exist on message base. This would
// allow inserting custom messages for totems/pets that indicate their death/recall.
// This would have to be returned here to be added to the message stream.
// Idk how feasible that is though. Maybe the original processor can handle this
// for general types.
func (c Characters) Process(m messages.Message) (bool, error) {
	// Add all affected characters to the instance's character list
	activityChange := c.AddAll(m.Affects()...)

	err := c.All.ForEach(func(char Character) error {
		before := char.IsActive()

		// TODO: Dead characters that will never return should be removed from processing?
		// Or at least have some kind of speedup
		err := char.Process(m)
		if err != nil {
			return fmt.Errorf("processing character %s: %w", char.ID().String(), err)
		}

		c.trackActive(char)
		if before != char.IsActive() {
			activityChange = true
		}
		return nil
	})
	if err != nil {
		return activityChange, err
	}

	return activityChange, nil
}

func (c Characters) trackActive(char Character) {
	if char.IsActive() {
		c.active[char.ID()] = struct{}{}
	} else {
		delete(c.active, char.ID())
	}
}

func (c Characters) ActiveCharactersCount() int {
	return len(c.active)
}
