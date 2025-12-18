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
	switch data := m.(type) {
	case messages.Damage:
		// CoreHounds when they die can still be attacked, but all damage is resisted or
		// absorbed, resulting in 0 damage. This means the corehound is still dead. If we
		// ignore 0 damage events, then we all is fixed. If the corehound is revived,
		// then direct damage will correctly resurrect it.
		if data.Amount == 0 {
			return nil
		}
	}

	return c.Common.Process(m)
}
