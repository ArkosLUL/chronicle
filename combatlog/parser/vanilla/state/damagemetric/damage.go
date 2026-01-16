package damagemetric

import (
	"errors"
	"sort"
	"time"

	"github.com/Emyrk/chronicle/combatlog/consumers"
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
)

var _ consumers.Consumer = (*Damage)(nil)

type ActiveDetector interface {
	ActiveCharactersCount() int
}

type Damage struct {
	Events   []Event
	detector ActiveDetector
}

type Event struct {
	Timestamp time.Time

	Source *guid.GUID
	Target guid.GUID
	Amount int32

	From string
}

func New(detector ActiveDetector) *Damage {
	return &Damage{
		Events:   make([]Event, 0),
		detector: detector,
	}
}

func (d *Damage) Process(m messages.Message) error {
	switch data := m.(type) {
	case messages.Damage:
		from := "Auto Attack"
		if data.SpellName != nil {
			from = *data.SpellName
		} else if data.EnvironmentType != nil {
			from = data.EnvironmentType.String()
		}
		d.Events = append(d.Events, Event{
			Timestamp: data.Timestamp,
			Source:    data.Caster,
			Target:    data.Target,
			Amount:    data.Amount,
			From:      from,
		})
		return nil
	default:
		return nil
	}
}

func (d *Damage) insertEvent(ev Event) {
	if len(d.Events) == 0 {
		d.Events = append(d.Events, ev)
		return
	}

	last := d.Events[len(d.Events)-1]
	if ev.Timestamp.Equal(last.Timestamp) ||
		ev.Timestamp.After(last.Timestamp) {
		d.Events = append(d.Events, ev)
		return
	}

	// Insert into the right place
	// Find first index i where evs[i].Timestamp > ev.Timestamp
	i := sort.Search(len(d.Events), func(i int) bool {
		return d.Events[i].Timestamp.After(ev.Timestamp)
	})

	// Make room
	d.Events = append(d.Events, Event{})
	copy(d.Events[i+1:], d.Events[i:])
	d.Events[i] = ev
}

func (d *Damage) Range(start, end time.Time, each func(e Event)) error {
	if each == nil {
		return nil
	}
	if !start.Before(end) {
		return errors.New("start time must be before end time")
	}

	// Find first index i where evs[i].Timestamp >= start
	i := sort.Search(len(d.Events), func(i int) bool {
		return !d.Events[i].Timestamp.Before(start)
	})

	// Iterate until evs[i].Timestamp >= end
	for ; i < len(d.Events); i++ {
		if !d.Events[i].Timestamp.Before(end) { // evs[i].Timestamp >= end
			break
		}
		each(d.Events[i])
	}

	return nil
}
