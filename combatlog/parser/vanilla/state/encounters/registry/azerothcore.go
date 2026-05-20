package registry

import (
	"log/slog"

	classic "github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/instances"
	"github.com/Emyrk/chronicle/combatlog/parser/wotlk/azerothcore/instances"
)

func AzerothcoreStaticRegistry(logger *slog.Logger) *Registry {
	r := NewRegistry(logger)

	RegisterClassicEncounters(r)
	// These are changed to level 80
	r.DeleteEntry(classic.OnyxiaFactory.Name)
	r.DeleteEntry(classic.NaxxramasFactory.Name)

	// Dungeons
	r.RegisterEntry(FromCommonFactory(instances.BloodFurnaceFactory))
	r.RegisterEntry(FromCommonFactory(instances.NexusFactory))
	r.RegisterEntry(FromCommonFactory(instances.OculusFactory))
	r.RegisterEntry(FromCommonFactory(instances.ForgeOfSoulsFactory))
	r.RegisterEntry(FromCommonFactory(instances.HallsOfReflectionFactory))

	// Raids
	r.RegisterEntry(FromCommonFactory(instances.VoAFactory))
	r.RegisterEntry(FromCommonFactory(instances.ObsidianSanctumFactory))
	r.RegisterEntry(FromCommonFactory(instances.EyeOfEternityFactory))
	r.RegisterEntry(FromCommonFactory(instances.TrialOfTheCrusaderFactory).WithComment("Bosses and major adds registered; faction champions are not exhaustive"))
	r.RegisterEntry(FromCommonFactory(instances.RubySanctumFactory))
	r.RegisterEntry(FromCommonFactory(instances.NaxxramasFactory))
	r.RegisterEntry(FromCommonFactory(instances.IcecrownCitadelFactory).WithComment("Boss-first coverage for major encounters; trash and some scripted events are not yet exhaustive"))

	return r
}
