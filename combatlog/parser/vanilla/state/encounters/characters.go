package encounters

import (
	"errors"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
)

type Characters map[guid.GUID]*Character

func NewCharacters() Characters {
	return make(Characters)
}

func (c Characters) AddAll(now time.Time, ids ...guid.GUID) {
	for _, id := range ids {
		c.Add(now, id)
	}
}

func (c Characters) Add(now time.Time, id guid.GUID) *Character {
	char, exists := c[id]
	if !exists {
		char = NewCharacter(id, now)
		c[id] = char
	}
	return char
}

type Character struct {
	ID guid.GUID
	// A character's activity periods.
	Activity *ActivePeriods

	// LastSlain is the last slain message for this character.
	// If the character is revived, set this to nil.
	LastSlain messages.Message
}

func NewCharacter(id guid.GUID, now time.Time) *Character {
	const defaultTimeout = time.Second * 60
	return &Character{
		ID: id,
		Activity: &ActivePeriods{
			Periods:     make([]Active, 0),
			TimeoutBump: defaultTimeout,
			NextTimeout: now.Add(defaultTimeout),
		},
	}
}

// RecentlySlain returns if the character was slain within the last second.
func (c *Character) RecentlySlain(m messages.Message) bool {
	if c.LastSlain == nil {
		return false
	}
	return m.Date().Sub(c.LastSlain.Date()) < time.Second
}

func (c *Character) ContainsMe(ids ...guid.GUID) bool {
	for _, id := range ids {
		if c.ID == id {
			return true
		}
	}

	return false
}

func (c *Character) Process(m messages.Message) error {
	defer func() {
		// Timeouts always end activity.
		if c.Activity.IsActive() && c.Activity.NextTimeout.Before(m.Date()) {
			c.Activity.End("timeout", m)
		}
	}()

	switch data := m.(type) {
	case messages.Slain:
		if c.ID == data.Victim {
			c.Activity.End("slain", m)
			c.LastSlain = m
		}

		if data.Killer != nil && c.ID == *data.Killer {
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

		if c.LastSlain != nil && data.Caster == c.ID && data.HitType.Has(types.HitTypePeriodic) {
			// Periodic damage does not indicate life.
			return nil
		}

		c.Activity.Bump(m)
		// Damage indicates activity.
		if !c.Activity.IsActive() {
			return c.Activity.Start("damage", m)
		}
	}
	return nil
}

type ActivePeriods struct {
	Periods      []Active
	LastActivity messages.Message
	NextTimeout  time.Time
	TimeoutBump  time.Duration
}

func (ap *ActivePeriods) Bump(m messages.Message) {
	ap.LastActivity = m
	ap.NextTimeout = m.Date().Add(ap.TimeoutBump)
}

func (ap *ActivePeriods) End(reason string, m messages.Message) {
	if len(ap.Periods) == 0 {
		return
	}
	ap.Periods[len(ap.Periods)-1].End = &ExplainedTimestamp{
		Timestamp:   m,
		Explanation: reason,
	}
}

func (ap *ActivePeriods) Start(reason string, m messages.Message) error {
	if ap.IsActive() {
		return errors.New("life already active")
	}
	ap.Periods = append(ap.Periods, Active{
		Start: &ExplainedTimestamp{
			Timestamp:   m,
			Explanation: reason,
		},
		End: nil,
	})
	return nil
}

// IsActive returns if the unit is currently known to be alive.
func (ap *ActivePeriods) IsActive() bool {
	if len(ap.Periods) == 0 {
		return false
	}

	return ap.Periods[len(ap.Periods)-1].End == nil
}

type Active struct {
	Start *ExplainedTimestamp
	End   *ExplainedTimestamp
}

type ExplainedTimestamp struct {
	Timestamp   messages.Message
	Explanation string
}
