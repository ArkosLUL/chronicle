package character

// TurtleCharacterFactories returns the CharacterFactory list for Turtle WoW (vanilla).
func TurtleCharacterFactories() []CharacterFactory {
	return []CharacterFactory{
		// Global
		NewTotemCharacter,
		NewCritterCharacter,
		NewObject,
		// Wailing Caverns
		NewDiscipleOfNaralex,
		// Deadmines
		NewSneedShredder,
		NewEdwinVanCleef,
		// Dire Maul
		NewImmolthar,
		// Molten Core
		NewCoreHoundCharacter,
		NewMajordomoPartyCharacter,
		NewIncindisCharacter,
		NewSulfuronHarbingerCharacter,
		NewSmoldarisBasaltharCharacter,
		NewSorcererThaneCharacter,
		NewRagnarosCharacter,
		NewGolemaggCharacter,
		// Blackwing Lair
		NewBroodlordLashlayer,
		NewRazorgore,
		NewShadowflameSpark,
		NewNefarian,
		// Onyxia
		NewOnyxiaCharacter,
		// Zul'Gurub
		NewHighPriestArlokk,
		NewHighPriestMarli,
		NewHighPriestessJeklik,
		NewHighPriestThekalParty,
		NewJindoHexxer,
		NewHooktoothFrenzy,
		// Scholomance
		NewJandiceBarov,
		NewDiseasedGhoul,
		// Stratholme
		NewCryptScarab,
		// Timbermaw Hold
		NewKarrsh,
		NewChieftainPartath,
		NewOrmanos,
		NewUrsol,
		NewNightmareFiend,
		NewVileSkitterer,
		NewSelenaxxFoulheart,
		NewLoktanagTheVile,
		NewPerotharn,
		// AQ 40
		NewCthun,
		// Naxx
		NewGluth,
		NewGrobbulus,
		NewAnubRekhan,
		NewThaddiusParty,
		NewGothikRoom,
		NewKelThuzadRoom,
		NewHeiganTheUnclean,
		NewDiseasedMaggot,
		NewEyeStalk,
		// Kara 40
		NewKruul,
		NewKing,
		NewMephistroth,
		NewDemonicEye,
		NewSanvTasDal,
		NewDraeneiNetherWalker,
		NewKeeperGnarlmoon,
		NewAnomalus,
		NewEchoOfMedivh,
		NewFragmentOfRupturan,
		NewRupturanTheBroken,
		NewFelheart,
		NewLivingStone,
		NewIncantagos,
		// Emerald Sanctum
		NewSolnius,
	}
}
