package registry

import (
	"log/slog"

	classic "github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/instances"
	"github.com/Emyrk/chronicle/combatlog/parser/wotlk/warmane/instances"
)

func WarmaneRegistry(logger *slog.Logger) *Registry {
	r := NewRegistry(logger)

	// Dungeons
	r.RegisterEntry(FromCommonFactory(instances.NexusFactory))
	r.RegisterEntry(FromCommonFactory(classic.DeadminesFactory))
	r.RegisterEntry(FromCommonFactory(classic.WailingCavernsFactory))
	r.RegisterEntry(FromCommonFactory(classic.RazorfenKraulFactory))
	r.RegisterEntry(FromCommonFactory(classic.RagefireChasmFactory))
	r.RegisterEntry(FromCommonFactory(classic.ScarletMonasteryCathedralFactory))
	r.RegisterEntry(FromCommonFactory(classic.ScarletMonasteryLibraryFactory))
	r.RegisterEntry(FromCommonFactory(classic.BlackrockDepthsFactory).WithComment("Most bosses & mobs are not yet supported"))
	r.RegisterEntry(FromCommonFactory(classic.ScholomanceFactory).WithComment("**new** not fully implemented"))
	r.RegisterEntry(FromCommonFactory(classic.StratholmeFactory).WithComment("Only undead side, mechanics not implemented"))
	r.RegisterEntry(FromCommonFactory(classic.DireMaulFactory))
	r.RegisterEntry(FromCommonFactory(classic.StockadesFactory))
	r.RegisterEntry(FromCommonFactory(classic.SunkenTempleFactory).WithComment("not yet complete"))
	r.RegisterEntry(FromCommonFactory(classic.BlackrockSpireFactory).WithComment("Only upper spire is supported at the moment"))

	// Raids
	r.RegisterEntry(FromCommonFactory(instances.VoAFactory))
	r.RegisterEntry(FromCommonFactory(instances.ObsidianSanctumFactory))

	return r
}
