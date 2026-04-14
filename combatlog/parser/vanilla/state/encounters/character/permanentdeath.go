package character

import (
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/period"
)

type PermanentDeath struct {
	characterBase
	dead bool
}

func NewPermanentDeath(c characterBase) *PermanentDeath {
	return &PermanentDeath{
		characterBase: c,
	}
}

func (c *PermanentDeath) Process(m messages.Message) error {
	if c.dead {
		return nil
	}

	err := c.characterBase.Process(m)
	if err != nil {
		return err
	}

	if p, ok := c.CurrentPeriod(); ok && p.EndState == period.EndStateSlain {
		c.dead = true
	}

	return nil
}
