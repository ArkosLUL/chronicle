package registry

import (
	"fmt"
	"log/slog"

	"github.com/Emyrk/chronicle/combatlog/parser/types/zone"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/instances"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/instances/blackrockspire"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/instances/smcathedral"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/instances/smlibrary"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/unitdb"
)

// InstanceFactory creates a new instance
type InstanceFactory func(logger *slog.Logger, db *unitdb.Units, z zone.Zone) instances.Instance

// DefaultRegistry returns a registry with all known instances
func DefaultRegistry(logger *slog.Logger) *Registry {
	r := NewRegistry(logger)

	// Register instances here as you add them
	// Example:
	r.Register(wrap(smcathedral.New))
	r.Register(wrap(smlibrary.New))
	r.Register(wrap(blackrockspire.New))
	// r.Register("Molten Core", moltencore.New)
	// r.Register("Onyxia's Lair", onyxia.New)

	return r
}

// Registry manages available instances
type Registry struct {
	factories map[string]InstanceFactory
	logger    *slog.Logger
}

// NewRegistry creates a new instance registry
func NewRegistry(logger *slog.Logger) *Registry {
	return &Registry{
		factories: make(map[string]InstanceFactory),
		logger:    logger,
	}
}

// Register adds an instance factory to the registry
func (r *Registry) Register(factory InstanceFactory) {
	// temporary instance to get the name
	tmp := factory(nil, nil, zone.Zone{})
	name := tmp.Name()
	if _, exists := r.factories[name]; exists {
		panic(fmt.Sprintf("instance factory named %s already exists", name))
	}
	r.factories[name] = factory
	r.logger.Debug("registered instance", slog.String("name", name))
}

// GetInstance returns an instance for the given zone, or nil if none match
func (r *Registry) GetInstance(z zone.Zone, db *unitdb.Units) instances.Instance {
	for name, factory := range r.factories {
		// Create a temporary instance to check if it matches
		inst := factory(r.logger, db, z)
		if inst.MatchesZone(z) {
			r.logger.Debug("matched instance",
				slog.String("zone", z.Name),
				slog.String("instance", name),
			)
			return inst
		}
	}
	return nil
}

// AllInstances returns all registered instance names
func (r *Registry) AllInstances() []string {
	names := make([]string, 0, len(r.factories))
	for name := range r.factories {
		names = append(names, name)
	}
	return names
}

func wrap[i instances.Instance](do func(logger *slog.Logger, db *unitdb.Units, z zone.Zone) i) InstanceFactory {
	return func(logger *slog.Logger, db *unitdb.Units, z zone.Zone) instances.Instance {
		return do(logger, db, z)
	}
}
