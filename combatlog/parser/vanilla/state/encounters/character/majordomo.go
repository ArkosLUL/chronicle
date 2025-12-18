package character

import (
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
)

type MajordomoParty struct {
	*Common
	all         *Characters
	isMajordomo bool
}

const (
	flamewakerElite  = 11664
	flamewakerHealer = 11663
	majorDomoEntry   = 12018
)

func NewMajordomoPartyCharacter(id guid.GUID, all *Characters) (Character, bool) {
	if !id.IsCreature() {
		return nil, false
	}

	entry, ok := id.GetEntry()
	if !ok {
		return nil, false
	}

	isMajordomo := false
	switch entry {
	case flamewakerElite, flamewakerHealer:
	// in the party!
	case majorDomoEntry:
		isMajordomo = true
	default:
		return nil, false
	}

	return &MajordomoParty{
		Common:      NewCommonCharacter(id, all),
		all:         all,
		isMajordomo: isMajordomo,
	}, true
}

func (c *MajordomoParty) Process(m messages.Message) error {
	wasActive := c.IsActive()

	err := c.Common.Process(m)
	if err != nil {
		return err
	}

	// If someone was slain, or this unit just became inactive, then tell
	// Majordomo to do an activity check.
	_, isSlain := m.(messages.Slain)
	if isSlain || (wasActive && !c.IsActive()) {
		c.processAddCheck(m)
	}

	return nil
}

func (c *MajordomoParty) getMajorDomo() (*MajordomoParty, bool) {
	major, ok := c.all.ByEntry[majorDomoEntry]
	if !ok || len(major) != 1 {
		return nil, false
	}

	typed, ok := major[0].(*MajordomoParty)
	if !ok {
		return nil, false
	}

	return typed, true
}

func (c *MajordomoParty) processAddCheck(m messages.Message) {
	if !c.isMajordomo {
		// Find him
		major, ok := c.getMajorDomo()
		if !ok {
			return
		}
		major.processAddCheck(m)
		return
	}

	if !c.IsActive() {
		return // Nothing to do if Majordomo is not active
	}

	elites := c.all.ByEntry[11664]  // Famewaker elite
	healers := c.all.ByEntry[11663] // Flamewaker healer
	if len(elites)+len(healers) != 8 {
		return
	}

	for _, char := range elites {
		if char.IsActive() {
			return
		}
	}

	for _, char := range healers {
		if char.IsActive() {
			return
		}
	}

	c.Died("all_adds_dead", m)
}
