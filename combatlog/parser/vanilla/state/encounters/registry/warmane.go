package registry

import (
	"log/slog"

	"github.com/Emyrk/chronicle/combatlog/parser/wotlk/warmane/instances"
)

func WarmaneRegistry(logger *slog.Logger) *Registry {
	r := NewRegistry(logger)

	// Dungeons
	r.RegisterEntry(FromCommonFactory(instances.NexusFactory))

	// Raids
	r.RegisterEntry(FromCommonFactory(instances.VoAFactory))

	return r
}
