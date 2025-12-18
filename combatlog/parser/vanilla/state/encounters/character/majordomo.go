package character

import (
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
)

// Majordomo is no longer active when all adds are killed.
type Majordomo struct {
	*Common
	all *Characters

	done bool
}

func NewMajordomoCharacter(id guid.GUID, all *Characters) (Character, bool) {
	if !id.IsCreature() {
		return nil, false
	}

	if entry, ok := id.GetEntry(); !ok || entry != 12018 {
		return nil, false
	}

	return &Majordomo{
		Common: NewCommonCharacter(id, all),
		all:    all,
	}, true
}

func (c *Majordomo) Process(m messages.Message) error {
	err := c.Common.Process(m)
	if err != nil {
		return err
	}

	// If Majordomo is inactive, nothing to do.
	if !c.IsActive() {
		return nil
	}

	// The fight is happening. Are all the adds dead?
	if c.addsInactive() {
		c.Died("all_adds_dead", m)
	}

	return nil
}

func (c *Majordomo) addsInactive() bool {
	elites := c.all.ByEntry[11664]  // Famewaker elite
	healers := c.all.ByEntry[11663] // Flamewaker healer
	if len(elites)+len(healers) != 8 {
		return false
	}

	for _, char := range elites {
		if char.IsActive() {
			return false
		}
	}

	for _, char := range healers {
		if char.IsActive() {
			return false
		}
	}

	return true
}
