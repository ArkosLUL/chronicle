package character

import (
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/data/totems"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
)

type Totem struct {
	*Base[TotemCharacterData]
}

type TotemCharacterData struct {
	Self totems.Totem
}

func NewTotemCharacter(id guid.GUID, all Characters) *Totem {
	return &Totem{
		Base: NewBaseCharacter[TotemCharacterData](id, all),
	}
}

// TODO: REDO PROCESS FOR TOTEMS
// - Look for "Cast" for when it comes alive to set max life
// - look for owner "recall"
// - look for owner death?
func (c *Totem) Process(m messages.Message) error {
	defer func() {
		// Timeouts should be checked on every timestamp
		c.processTimeout(m)
	}()

	switch data := m.(type) {
	case messages.Slain:
		if c.id == data.Victim {
			c.Activity.End(ReasonSlain, m)
			c.LastSlain = m
		}

		if data.Killer != nil && c.id == *data.Killer {
			// Being the killer does not indicate activity.
			// Could be killed from a dot for example.
		}
	case messages.Damage:
		if !c.ContainsMe(data.Target, data.Caster) {
			return nil
		}

		// Damage can tick after death, so ignore if recently slain.
		if c.RecentlySlain(m) {
			return nil
		}

		if c.LastSlain != nil && data.Caster == c.id && data.HitType.Has(types.HitTypePeriodic) {
			// Periodic damage does not indicate life.
			return nil
		}

		c.Activity.Bump(m)
		// Damage indicates activity.
		if !c.Activity.IsActive() {
			const defaultTimeout = time.Second * 60
			return c.Activity.Start(&flavoredActive[TotemCharacterData]{
				Active: Active{
					Start: &ExplainedTimestamp{
						Timestamp:   m,
						Explanation: "damage",
					},
					End:          nil,
					LastActivity: m,
					NextTimeout:  m.Date().Add(defaultTimeout),
					TimeoutBump:  defaultTimeout,
				},
			})
		}
	}
	return nil
}
