package encounters

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/unitdb"
)

const (
	ReasonTimeout = "timeout"
	ReasonSlain   = "slain"
)

type Characters struct {
	All map[guid.GUID]*Character
	db  *unitdb.Units
}

func NewCharacters(db *unitdb.Units) *Characters {
	return &Characters{
		db:  db,
		All: make(map[guid.GUID]*Character),
	}
}

func (c Characters) AddAll(now time.Time, ids ...guid.GUID) {
	for _, id := range ids {
		c.Add(now, id)
	}
}

func (c Characters) Add(now time.Time, id guid.GUID) *Character {
	char, exists := c.All[id]
	if !exists {
		// TODO: When making a new character, we should have a hook for special
		// types.
		// E.g:
		//  - Totems: have a fixed lifetime & despawn after recall or owner died
		//  - Pets: Die when their owner dies

		char = NewCharacter(id, now)
		c.All[id] = char
	}
	return char
}

// TODO: Maybe a "synthetic" boolean should exist on message base. This would
// allow inserting custom messages for totems/pets that indicate their death/recall.
// This would have to be returned here to be added to the message stream.
// Idk how feasible that is though. Maybe the original processor can handle this
// for general types.
func (c Characters) Process(m messages.Message) error {
	// Add all affected characters to the instance's character list
	c.AddAll(m.Date(), m.Affects()...)

	for _, char := range c.All {
		err := char.Process(m)
		if err != nil {
			return fmt.Errorf("processing character %s: %w", char.ID.String(), err)
		}
	}
	return nil
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

func (c *Character) NamedString(name string) string {
	if c == nil {
		return "<nil Character>"
	}

	id := fmt.Sprintf("ID: %s", c.ID)
	if name != "" {
		id = fmt.Sprintf("Name: %s, ID: %s", name, id)
	}

	var str strings.Builder
	str.WriteString(fmt.Sprintf("Character(%s)", id))
	if c.LastSlain != nil {
		str.WriteString(fmt.Sprintf(", LastSlain: %s", messages.ToString(c.LastSlain)))
	}
	str.WriteString("\n")
	str.WriteString(fmt.Sprintf("Activity: %s\n", c.Activity.String()))

	return str.String()
}

func (c *Character) String() string {
	return c.NamedString("")
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
			c.Activity.End(ReasonTimeout, messages.TimedOut(c.Activity.NextTimeout))
		}
	}()

	switch data := m.(type) {
	case messages.Slain:
		if c.ID == data.Victim {
			c.Activity.End(ReasonSlain, m)
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

func (ap *ActivePeriods) String() string {
	var str strings.Builder
	str.WriteString(fmt.Sprintf("%d Periods", len(ap.Periods)))
	str.WriteString(fmt.Sprintf(", Active=%t", ap.IsActive()))
	if ap.LastActivity != nil {
		str.WriteString(fmt.Sprintf(", LatAct=%s", messages.ToString(ap.LastActivity)))
	}

	str.WriteString("\n")
	for _, p := range ap.Periods {
		str.WriteString(fmt.Sprintf("  %s\n", p.String()))
	}

	return str.String()
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

func (ap *ActivePeriods) LastInactive() (string, messages.Message) {
	if len(ap.Periods) == 0 {
		return "", nil
	}
	last := ap.Periods[len(ap.Periods)-1]
	if last.End == nil {
		return "", nil
	}
	return last.End.Explanation, last.End.Timestamp
}

type Active struct {
	Start *ExplainedTimestamp
	End   *ExplainedTimestamp
}

func (a Active) String() string {
	if a.Start == nil && a.End == nil {
		return "Inactive(Start:<nil>, End:<nil>)"
	}

	if a.End == nil {
		return fmt.Sprintf("Active(Start: %s, End: <nil>)", a.Start)
	}

	return fmt.Sprintf("Inactive(Start: %s, End: %s)", a.Start, a.End)
}

type ExplainedTimestamp struct {
	Timestamp   messages.Message
	Explanation string
}

func (et ExplainedTimestamp) String() string {
	return fmt.Sprintf("%s (Reason: %s)", messages.ToString(et.Timestamp), et.Explanation)
}
