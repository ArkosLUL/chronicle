package combatmetrics

import (
  "errors"
  "sort"
  "time"

  "github.com/Emyrk/chronicle/combatlog/consumers"
  "github.com/Emyrk/chronicle/combatlog/parser/types"
  "github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
)

var _ consumers.Consumer = (*Metrics)(nil)

type ActiveDetector interface {
	ActiveCharactersCount() int
}

type Metrics struct {
	Events   []messages.Message
	detector ActiveDetector
}

func New(detector ActiveDetector) *Metrics {
	return &Metrics{
		Events:   make([]messages.Message, 0),
		detector: detector,
	}
}

func (met *Metrics) Process(m messages.Message) error {
	switch data := m.(type) {
	case messages.Damage:
		met.insertEvent(m)
		return nil
	case messages.Heal:
		met.insertEvent(m)
	case messages.ResourceChange:
		if data.Resource == types.ResourceHealth {
			met.insertEvent(m)
		}
	default:
		return nil
	}
	return nil
}

func (met *Metrics) insertEvent(ev messages.Message) {
	if len(met.Events) == 0 {
		met.Events = append(met.Events, ev)
		return
	}

	last := met.Events[len(met.Events)-1]
	if ev.Date().Equal(last.Date()) ||
		ev.Date().After(last.Date()) {
		met.Events = append(met.Events, ev)
		return
	}

	// Insert into the right place
	// Find first index i where evs[i].Timestamp > ev.Timestamp
	i := sort.Search(len(met.Events), func(i int) bool {
		return met.Events[i].Date().After(ev.Date())
	})

	// Make room
	met.Events = append(met.Events, nil)
	copy(met.Events[i+1:], met.Events[i:])
	met.Events[i] = ev
}

func (met *Metrics) Range(start, end time.Time, each func(e messages.Message) error) error {
	if each == nil {
		return nil
	}
	if !start.Before(end) {
		return errors.New("start time must be before end time")
	}

	// Find first index i where evs[i].Timestamp >= start
	i := sort.Search(len(met.Events), func(i int) bool {
		return !met.Events[i].Date().Before(start)
	})

	// Iterate until evs[i].Timestamp >= end
	for ; i < len(met.Events); i++ {
		if !met.Events[i].Date().Before(end) { // evs[i].Timestamp >= end
			break
		}
		err := each(met.Events[i])
		if err != nil {
			return err
		}
	}

	return nil
}
