package state

import (
	"log/slog"

	"github.com/Emyrk/chronicle/combatlog/parser/types/zone"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/instances/blackrockspire"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/instances/smcathedral"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/instances/smlibrary"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/unitdb"
)

func wrap[i encounters.Instance](do func(logger *slog.Logger, db *unitdb.Units, z zone.Zone) i) encounters.InstanceFactory {
	return func(logger *slog.Logger, db *unitdb.Units, z zone.Zone) encounters.Instance {
		return do(logger, db, z)
	}
}

// DefaultRegistry returns a registry with all known instances
func DefaultRegistry(logger *slog.Logger) *encounters.Registry {
	r := encounters.NewRegistry(logger)

	// Register instances here as you add them
	// Example:
	r.Register(wrap(smcathedral.New))
	r.Register(wrap(smlibrary.New))
	r.Register(wrap(blackrockspire.New))
	// r.Register("Molten Core", moltencore.New)
	// r.Register("Onyxia's Lair", onyxia.New)

	return r
}
