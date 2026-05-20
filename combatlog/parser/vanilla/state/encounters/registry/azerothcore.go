package registry

import (
	"log/slog"

	classic "github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/instances"
	"github.com/Emyrk/chronicle/combatlog/parser/wotlk/azerothcore/instances"
)

func RegisterTBCEncounters(r *Registry) {
	r.RegisterEntry(FromCommonFactory(instances.MagtheridonsLairFactory))
}

func AzerothcoreStaticRegistry(logger *slog.Logger) *Registry {
	r := NewRegistry(logger)

	RegisterClassicEncounters(r)
	RegisterTBCEncounters(r)
	// These are changed to level 80
	r.DeleteEntry(classic.OnyxiaFactory.Name)
	r.DeleteEntry(classic.NaxxramasFactory.Name)

	// Dungeons
	r.RegisterEntry(FromCommonFactory(instances.BloodFurnaceFactory))
	r.RegisterEntry(FromCommonFactory(instances.NexusFactory))
	r.RegisterEntry(FromCommonFactory(instances.OculusFactory))
	r.RegisterEntry(FromCommonFactory(instances.ForgeOfSoulsFactory))
	r.RegisterEntry(FromCommonFactory(instances.HallsOfReflectionFactory))

	r.RegisterEntry(FromCommonFactory(instances.TrialOfTheChampionFactory).WithComment("need review"))
	r.RegisterEntry(FromCommonFactory(instances.PitOfSaronFactory).WithComment("need review"))
	r.RegisterEntry(FromCommonFactory(instances.UtgardeKeepFactory).WithComment("need review"))
	r.RegisterEntry(FromCommonFactory(instances.UtgardePinnacleFactory).WithComment("need review"))
	r.RegisterEntry(FromCommonFactory(instances.CullingOfStratholmeFactory).WithComment("need review"))
	r.RegisterEntry(FromCommonFactory(instances.HallsOfStoneFactory).WithComment("need review"))
	r.RegisterEntry(FromCommonFactory(instances.DrakTharonKeepFactory).WithComment("need review"))
	r.RegisterEntry(FromCommonFactory(instances.AzjolNerubFactory).WithComment("need review"))
	r.RegisterEntry(FromCommonFactory(instances.HallsOfLightningFactory).WithComment("need review"))
	r.RegisterEntry(FromCommonFactory(instances.GundrakFactory).WithComment("need review"))
	r.RegisterEntry(FromCommonFactory(instances.VioletHoldFactory).WithComment("need review"))
	r.RegisterEntry(FromCommonFactory(instances.AhnkahetOldKingdomFactory).WithComment("need review"))

	// Raids
	r.RegisterEntry(FromCommonFactory(instances.VoAFactory))
	r.RegisterEntry(FromCommonFactory(instances.ObsidianSanctumFactory))
	r.RegisterEntry(FromCommonFactory(instances.EyeOfEternityFactory))
	r.RegisterEntry(FromCommonFactory(instances.TrialOfTheCrusaderFactory).WithComment("Bosses and major adds registered; faction champions are not exhaustive"))
	r.RegisterEntry(FromCommonFactory(instances.RubySanctumFactory))
	r.RegisterEntry(FromCommonFactory(instances.NaxxramasFactory))
	r.RegisterEntry(FromCommonFactory(instances.IcecrownCitadelFactory).WithComment("Boss-first coverage for major encounters; trash and some scripted events are not yet exhaustive"))
	r.RegisterEntry(FromCommonFactory(instances.UlduarFactory).WithComment("needs review"))
	return r
}
