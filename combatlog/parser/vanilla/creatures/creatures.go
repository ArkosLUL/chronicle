package creatures

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"

	"github.com/Emyrk/chronicle/combatlog/parser/types/zone"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/unitdb"
)

type Creatures struct {
	logger *slog.Logger

	// CurrentZone is the zone the player is currently in.
	CurrentZone zone.Zone
	ZonedUnits  map[string]map[uint32]string

	// Units holds information about all units seen so far.
	// Friendly/Foe/Relationships, etc.
	Units *unitdb.Units
}

func New(logger *slog.Logger) *Creatures {
	s := &Creatures{
		logger:      logger,
		Units:       unitdb.New(),
		CurrentZone: zone.Zone{},
		ZonedUnits:  map[string]map[uint32]string{},
	}
	return s
}

func (s *Creatures) Consume(ctx context.Context, p *vanilla.Parser) error {
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		msgs, err := p.Advance()
		if err != nil {
			if vanilla.IsFatalError(err) {
				return fmt.Errorf("fatal parser error: %w", err)
			}
			if errors.Is(err, io.EOF) {
				return nil
			}
			s.logger.Error("Error advancing parser", slog.String("error", err.Error()))
		}
		for _, msg := range msgs {
			if up, ok := msg.(messages.UnparsedLine); ok {
				s.logger.Warn("Unparsed line", slog.String("line", up.Content))
			}
			err = s.Process(msg)
			if err != nil {
				return fmt.Errorf("state process: %w", err)
			}
		}
	}
}

func (s *Creatures) Process(m messages.Message) error {
	switch typed := m.(type) {
	case messages.Zone:
		s.Zone(typed)
	case messages.Combatant:
		s.Combatant(typed)
	case messages.Unit:
		s.Unit(typed)
	}

	for _, gid := range m.Affects() {
		if !gid.IsCreature() {
			continue
		}

		entry, ok := gid.GetEntry()
		if !ok {
			continue
		}

		unit, ok := s.Units.Get(gid)
		if !ok {
			s.logger.Error("Could not find unit", slog.String("gid", gid.String()))
			continue
		}

		if s.ZonedUnits[s.CurrentZone.Name] == nil {
			s.ZonedUnits[s.CurrentZone.Name] = map[uint32]string{}
		}
		s.ZonedUnits[s.CurrentZone.Name][entry] = unit.Name
	}

	return nil
}

func (s *Creatures) Combatant(c messages.Combatant) {
	s.Units.UpdatePlayer(c.Combatant)
}

func (s *Creatures) Unit(u messages.Unit) {
	s.Units.Update(u.Info)
}

func (s *Creatures) Zone(z messages.Zone) {
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

	s.logger.Info(fmt.Sprintf("Zone changed to %q (instance %d)", z.Name, z.InstanceID),
		slog.String("zone_name", z.Name),
		slog.Uint64("instance_id", uint64(z.InstanceID)),
		slog.String("exited_from", s.CurrentZone.Name),
		slog.Uint64("exited_instance_id", uint64(s.CurrentZone.InstanceID)),
		slog.Time("seen", z.Seen),
	)
}
