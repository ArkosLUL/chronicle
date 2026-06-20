package characters

import (
	"github.com/Emyrk/chronicle/combatlog/parser/common/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/database/gamedb/chrondbc"
)

type IgnoreCast struct {
	CharacterBase

	ignoreTarget bool
	ignoreSource bool
	ignoreSpells map[chrondbc.SpellID]struct{}
}

func NewIgnoreCastCharacter(c CharacterBase, spells ...chrondbc.SpellID) *IgnoreCast {
	ignore := make(map[chrondbc.SpellID]struct{})
	for _, sp := range spells {
		ignore[sp] = struct{}{}
	}

	return &IgnoreCast{
		CharacterBase: c,
		ignoreTarget:  false,
		ignoreSource:  false,
		ignoreSpells:  ignore,
	}
}

func NewIgnoreCast(match uint32, spells ...chrondbc.SpellID) func(id guid.GUID, all *Characters) (*IgnoreCast, bool) {
	return func(id guid.GUID, all *Characters) (*IgnoreCast, bool) {
		entry, ok := id.GetEntry()
		if !ok {
			return nil, false
		}

		if entry != match {
			return nil, false
		}

		c := NewCommonCharacter(id, all)
		return NewIgnoreCastCharacter(c, spells...), true
	}
}

func (c *IgnoreCast) IgnoreTarget() {
	c.ignoreTarget = true
}

func (c *IgnoreCast) IgnoreSource() {
	c.ignoreSource = true
}

func (c *IgnoreCast) Process(m messages.Message) error {
	switch msg := m.(type) {
	case *messages.Damage:
		if c.Ignore(msg.Caster, &msg.Target, msg.SpellData) {
			return nil
		}
	case *messages.SpellGo:
		if c.Ignore(&msg.Caster, msg.Target, msg.SpellData) {
			return nil
		}
	case *messages.Aura:
		if c.Ignore(msg.Source, &msg.Target, msg.SpellData) {
			return nil
		}
	case *messages.AuraCast:
		if c.Ignore(&msg.Caster, msg.Target, msg.Spell) {
			return nil
		}
	case *messages.SpellStart:
		if c.Ignore(&msg.Caster, msg.Target, msg.SpellData) {
			return nil
		}
	}

	err := c.CharacterBase.Process(m)
	if err != nil {
		return err
	}

	return nil
}

func (c *IgnoreCast) Ignore(src *guid.GUID, tgt *guid.GUID, sp *chrondbc.Spell) bool {
	if sp == nil {
		return false
	}

	if (src != nil && !c.ignoreSource && *src == c.ID()) ||
		(tgt != nil && !c.ignoreTarget && *tgt == c.ID()) {
		_, ignore := c.ignoreSpells[sp.ID]
		return ignore
	}

	return false
}
