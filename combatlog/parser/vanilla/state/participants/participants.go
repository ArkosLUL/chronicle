package participants

import (
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/character"
)

var _ character.SetHook = (*Tracker)(nil)

type Tracker struct {
	Active map[guid.GUID]bool
}

func New() *Tracker {
	return &Tracker{
		Active: make(map[guid.GUID]bool),
	}
}

func (t *Tracker) ActivityChange(m messages.Message, chars ...character.Character) {
	for _, c := range chars {
		if c.IsActive() {
			t.Active[c.ID()] = true
		}
	}
}

func (t *Tracker) CharacterAdded(m messages.Message, chars ...character.Character) {}
