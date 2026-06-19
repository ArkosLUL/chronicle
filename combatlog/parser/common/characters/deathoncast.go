package characters

import (
	"github.com/Emyrk/chronicle/combatlog/parser/common/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/database/gamedb/chrondbc"
)

type DeathOnCast struct {
	CharacterBase
	spellID chrondbc.SpellID
}

func NewDeathOnCast(spellID chrondbc.SpellID, match ...uint32) func(id guid.GUID, all *Characters) (*DeathOnCast, bool) {
	return func(id guid.GUID, all *Characters) (*DeathOnCast, bool) {
		entry, ok := id.GetEntry()
		if !ok {
			return nil, false
		}

		for _, m := range match {
			if entry == m {
				return &DeathOnCast{
					CharacterBase: NewCommonCharacter(id, all),
					spellID:       spellID,
				}, true
			}
		}

		return nil, false
	}
}

func (c *DeathOnCast) Process(m messages.Message) error {
	err := c.CharacterBase.Process(m)
	if err != nil {
		return err
	}

	switch msg := m.(type) {
	case *messages.Damage:
		if msg.Caster != nil && *msg.Caster == c.ID() {
			c.SpellGo(m, msg.SpellData)
		}
	case *messages.SpellGo:
		if msg.Caster == c.ID() {
			c.SpellGo(m, msg.SpellData)
		}
	}

	return nil
}

func (c *DeathOnCast) SpellGo(m messages.Message, sp *chrondbc.Spell) {
	if sp == nil {
		return
	}

	if sp.ID == c.spellID {
		c.CharacterBase.Died("death_on_cast", m)
	}
}
