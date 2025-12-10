package state

import (
	"fmt"
	"log/slog"
	"slices"

	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/combatlog/parser/types/zone"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/unitdb"
)

type State struct {
	logger *slog.Logger
	Me     types.Unit

	// CurrentZone is the zone the player is currently in.
	CurrentZone     zone.Zone
	CurrentInstance encounters.Instance
	Instances       []encounters.Instance

	// Units holds information about all units seen so far.
	// Friendly/Foe/Relationships, etc.
	Units *unitdb.Units

	reg *encounters.Registry
}

func NewState(logger *slog.Logger, me types.Unit) *State {
	s := &State{
		logger:      logger,
		Me:          me,
		Units:       unitdb.New(),
		CurrentZone: zone.Zone{},
		reg:         DefaultRegistry(logger),
		Instances:   []encounters.Instance{},
	}
	//s.Fights = NewFights(s)
	return s
}

func (s *State) Process(m messages.Message) error {
	switch typed := m.(type) {
	case messages.Zone:
		s.Zone(typed)
	case messages.Damage:
		//s.Damage(typed)
	case messages.Cast:
		//s.CastV2(typed)
	case messages.Combatant:
		s.Combatant(typed)
	case messages.Unit:
		s.Unit(typed)
	case messages.Slain:
		//s.Slain(typed)
	}

	// encounter processing would go here
	if s.CurrentInstance != nil {
		err := s.CurrentInstance.Process(m)
		if err != nil {
			return fmt.Errorf("instance process: %w", err)
		}
	}
	return nil
}

func (s *State) Combatant(c messages.Combatant) {
	s.Units.UpdatePlayer(c.Combatant)
}

func (s *State) Unit(u messages.Unit) {
	s.Units.Update(u.Info)
}

func (s *State) Zone(z messages.Zone) {
	if z.Name == "" {
		// Ignore empty zones
		return
	}
	defer func() {
		// Always set the current zone at the end
		s.CurrentZone = z.Zone
	}()

	if s.CurrentZone.Equal(z.Zone) {
		return
	}

	if s.CurrentInstance != nil && !slices.ContainsFunc(s.Instances, func(instance encounters.Instance) bool {
		// TODO: Is pointer comparison sufficient here?
		return instance == s.CurrentInstance
	}) {
		s.Instances = append(s.Instances, s.CurrentInstance)
	}

	matched := false
	for _, inst := range s.Instances {
		if inst.MatchesZone(z.Zone) {
			s.CurrentInstance = inst
			matched = true
			s.logger.Info("Matched existing instance",
				slog.String("name", inst.Name()),
			)
		}
	}

	if !matched {
		s.CurrentInstance = s.reg.GetInstance(z.Zone, s.Units)
		if s.CurrentInstance != nil {
			s.logger.Info("Matched new instance",
				slog.String("name", s.CurrentInstance.Name()),
			)
		}
	}

	s.logger.Info(fmt.Sprintf("Zone changed to %q (instance %d)", z.Name, z.InstanceID),
		slog.String("zone_name", z.Name),
		slog.Uint64("instance_id", uint64(z.InstanceID)),
		slog.String("exited_from", s.CurrentZone.Name),
		slog.Uint64("exited_instance_id", uint64(s.CurrentZone.InstanceID)),
		slog.Time("seen", z.Seen),
	)
}
