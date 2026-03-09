package auras

import (
	"time"

	lru "github.com/hashicorp/golang-lru/v2"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/database/gamedb/chrondbc"
)

// AuraState holds the current stack count for an aura.
type AuraState struct {
	Buff   bool
	Stacks int32
	// Beyond this time, the aura can no longer exist
	MaxExistsUntil time.Time
}

// Tracking maintains active auras per unit.
type Tracking struct {
	// units maps GUID -> spell -> aura state
	units        map[guid.GUID]map[chrondbc.SpellID]*AuraState
	maxDurations *lru.Cache[chrondbc.SpellID, time.Duration]
}

func New() (*Tracking, error) {
	mlru, err := lru.New[chrondbc.SpellID, time.Duration](300)
	if err != nil {
		return nil, err
	}
	return &Tracking{
		units:        make(map[guid.GUID]map[chrondbc.SpellID]*AuraState),
		maxDurations: mlru,
	}, nil
}

func (t *Tracking) Process(m messages.Message) error {
	switch msg := m.(type) {
	case *messages.Aura:
		if msg.SpellData == nil {
			return nil
		}

		if _, ok := t.units[msg.Target]; !ok {
			t.units[msg.Target] = make(map[chrondbc.SpellID]*AuraState)
		}

		state, exists := t.units[msg.Target][msg.SpellData.ID]
		if !exists {
			state = &AuraState{}
			t.units[msg.Target][msg.SpellData.ID] = state
		}

		state.Stacks = msg.Amount
		state.Buff = msg.IsBuff

		// Calculate the maximum time the aura can exist based on any possible modifiers.
		dur := chrondbc.MaxAuraDuration(msg.SpellData)
		state.MaxExistsUntil = m.Date().Add(dur)
	}

	return nil
}
