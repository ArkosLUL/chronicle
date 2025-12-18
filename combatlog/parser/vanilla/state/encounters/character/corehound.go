package character

import (
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
)

// CoreHound can be damaged after death, and can come back to life.
type CoreHound struct {
	*Common
}

func NewCoreHoundCharacter(id guid.GUID, all *Characters) (Character, bool) {
	if !id.IsCreature() {
		return nil, false
	}

	if entry, ok := id.GetEntry(); !ok || entry != 11671 {
		return nil, false
	}

	return &CoreHound{
		Common: NewCommonCharacter(id, all),
	}, true
}

func (c *CoreHound) Process(m messages.Message) error {
	return c.Common.Process(m)
}
