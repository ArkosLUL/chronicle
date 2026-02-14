package registry

import (
	"fmt"
	"log/slog"

	"github.com/Emyrk/chronicle/combatlog/parser/types/zone"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/instances"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/unitdb"
)

// InstanceFactory creates a new instance
type InstanceFactory func(logger *slog.Logger, db *unitdb.Units, z zone.Zone) instances.Instance

// DefaultRegistry returns a registry with all known instances
func DefaultRegistry(logger *slog.Logger) *Registry {
	r := NewRegistry(logger)

	// Register instances here as you add them
	// 5 man
	r.Register(wrap(instances.Deadmines))
	r.Register(wrap(instances.RagefireChasm))
	r.Register(wrap(instances.ScarletMonasteryCathedral))
	r.Register(wrap(instances.ScarletMonasteryLibrary))
	r.RegisterWithComment(wrap(instances.BlackrockDepths), "Most bosses & mobs are not yet supported")

	r.RegisterWithComment(wrap(instances.BlackrockSpire), "Only upper spire is supported at the moment")

	// 10 man
	r.Register(wrap(instances.TowerOfKarazhan))

	// 20 man
	r.Register(wrap(instances.ZulGurub))

	// 40 man
	r.Register(wrap(instances.MoltenCore))
	r.Register(wrap(instances.Onyxia))
	r.Register(wrap(instances.EmeraldSanctum))

	return r
}

// Registry manages available instances
type Registry struct {
	factories      map[string]InstanceFactory
	factoryComment map[string]string
	logger         *slog.Logger
}

// NewRegistry creates a new instance registry
func NewRegistry(logger *slog.Logger) *Registry {
	return &Registry{
		factories:      make(map[string]InstanceFactory),
		factoryComment: make(map[string]string),
		logger:         logger,
	}
}

func (r *Registry) RegisterWithComment(factory InstanceFactory, comment string) {
	// temporary instance to get the name
	tmp := factory(nil, nil, zone.Zone{})
	name := tmp.Name()
	if _, exists := r.factories[name]; exists {
		panic(fmt.Sprintf("instance factory named %s already exists", name))
	}
	r.factories[name] = factory
	r.factoryComment[name] = comment
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

func (r *Registry) AllInstancesWithComments() map[string]string {
	all := make(map[string]string)
	for name := range r.factories {
		comment := r.factoryComment[name]
		all[name] = comment
	}
	return all
}

func wrap[i instances.Instance](do func(logger *slog.Logger, db *unitdb.Units, z zone.Zone) i) InstanceFactory {
	return func(logger *slog.Logger, db *unitdb.Units, z zone.Zone) instances.Instance {
		return do(logger, db, z)
	}
}
