package character

import (
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/period"
)

type PermanentDeath struct {
	Character
	dead bool
}

func NewPermanentDeath(c Character) *PermanentDeath {
	return &PermanentDeath{
		Character: c,
	}
}

func (c *PermanentDeath) Process(m messages.Message) error {
	if c.dead {
		return nil
	}

	err := c.Character.Process(m)
	if err != nil {
		return err
	}

	if p, ok := c.CurrentPeriod(); ok && p.EndState == period.EndStateSlain {
		c.dead = true
	}

	return nil
}
