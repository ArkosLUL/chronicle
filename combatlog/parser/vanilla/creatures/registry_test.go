package creatures_test

import (
	"log/slog"
	"testing"

	"github.com/Emyrk/chronicle/combatlog/parser/common/registry"
	"github.com/Emyrk/chronicle/database"
)

func RegistryForTests(t *testing.T) *registry.Registry {
	return registry.RegistryForFlavor(slog.Default(), database.WoWFlavor{database.FlavorVanilla, database.FlavorNightmareOfUrsol})
}
