package character

import (
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
)

func NewRagnarosCharacter(id guid.GUID, all *Characters) (Character, bool) {
	if !id.IsCreature() {
		return nil, false
	}

	entry, ok := id.GetEntry()
	if !ok {
		return nil, false
	}

	if entry != 11502 {
		return nil, false
	}

	c := NewCommonCharacter(id, all)
	c.Base.SetRecentlySlainDuration(time.Second * 15)
	return c, true
}
