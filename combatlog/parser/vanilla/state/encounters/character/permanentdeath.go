package character

import "github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"

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
	return c.Character.Process(m)
}

func (c *PermanentDeath) Died(reason string, m messages.Message) {
	c.dead = true
	c.Character.Died(reason, m)
}
