package instances

import "github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/instances/rankings"

// Factory variables expose the *CommonFactory for each instance, allowing
// access to metadata (zone names, hostile entries) without instantiating.
// The corresponding function variables (e.g. Deadmines = DeadminesFactory.New)
// are preserved for backward compatibility.
var (
	WindhornCanyonFactory = &CommonFactory{
		Name:      "Windhorn Canyon",
		ZoneNames: []string{"windhorn canyon"},
		ZoneName:  ZoneNameMatcher("windhorn canyon"),
		Hostiles:  FromMap(WindhornCanyonHostiles()),
	}

	DeadminesFactory = &CommonFactory{
		Name:      "Deadmines",
		ZoneNames: []string{"the deadmines"},
		ZoneName:  ZoneNameMatcher("the deadmines"),
		Hostiles:  FromMap(DeadminesHostiles()),
	}

	WailingCavernsFactory = &CommonFactory{
		Name:      "Wailing Caverns",
		ZoneNames: []string{"wailing caverns"},
		ZoneName:  ZoneNameMatcher("wailing caverns"),
		Hostiles:  FromMap(WailingCavernsHostiles()),
	}

	RazorfenKraulFactory = &CommonFactory{
		Name:      "Razorfen Kraul",
		ZoneNames: []string{"razorfen kraul"},
		ZoneName:  ZoneNameMatcher("razorfen kraul"),
		Hostiles:  FromMap(RazorfenKraulHostiles()),
	}

	ScarletMonasteryCathedralFactory = &CommonFactory{
		Name:      "Scarlet Monastery Cathedral",
		ZoneNames: []string{"scarlet monastery cathedral"},
		ZoneName:  ZoneNameMatcher("scarlet monastery cathedral"),
		Hostiles:  FromMap(CathedralHostiles()),
	}

	ScarletMonasteryLibraryFactory = &CommonFactory{
		Name:      "Scarlet Monastery Library",
		ZoneNames: []string{"scarlet monastery library"},
		ZoneName:  ZoneNameMatcher("scarlet monastery library"),
		Hostiles:  FromMap(SMLibraryHostiles()),
	}

	BlackrockSpireFactory = &CommonFactory{
		Name:      "Blackrock Spire",
		ZoneNames: []string{"blackrock spire"},
		ZoneName:  ZoneNameMatcher("blackrock spire"),
		Hostiles:  FromMap(BlackrockSpireHostiles()),
	}

	MoltenCoreFactory = &CommonFactory{
		Name:      "Molten Core",
		ZoneNames: []string{"molten core"},
		ZoneName:  ZoneNameMatcher("molten core"),
		Hostiles:  FromMap(MoltenCoreHostiles()),
		Rankings: &rankings.Rankings{
			Speedrun: &rankings.SpeedrunRules{
				Requirements: MoltenCoreSpeedrunRequirements(),
			},
		},
	}

	TowerOfKarazhanFactory = &CommonFactory{
		Name:      "Tower of Karazhan",
		ZoneNames: []string{"tower of karazhan", "the rock of desolation"},
		ZoneName:  ZoneNameMatcher("tower of karazhan", "the rock of desolation"),
		Hostiles:  FromMap(TowerOfKarazhanHostiles()),
	}

	OnyxiaFactory = &CommonFactory{
		Name:      "Onyxia's Lair",
		ZoneNames: []string{"onyxia's lair"},
		ZoneName:  ZoneNameMatcher("onyxia's lair"),
		Hostiles:  FromMap(OnyxiaHostiles()),
		Rankings: &rankings.Rankings{
			Speedrun: &rankings.SpeedrunRules{
				Requirements: OnyxiasLairSpeedrunRequirements(),
			},
		},
	}

	RagefireChasmFactory = &CommonFactory{
		Name:      "Ragefire Chasm",
		ZoneNames: []string{"ragefire chasm"},
		ZoneName:  ZoneNameMatcher("ragefire chasm", "Ragefire Chasm"),
		Hostiles:  FromMap(RagefireChasmHostiles()),
	}

	ZulGurubFactory = &CommonFactory{
		Name:      "Zul'Gurub",
		ZoneNames: []string{"zul'gurub"},
		ZoneName:  ZoneNameMatcher("zul'gurub"),
		Hostiles:  FromMap(ZulGurubHostiles()),
		Rankings: &rankings.Rankings{
			Speedrun: &rankings.SpeedrunRules{
				Requirements: ZulGurubSpeedrunRequirements(),
			},
		},
	}

	EmeraldSanctumFactory = &CommonFactory{
		Name:      "Emerald Sanctum",
		ZoneNames: []string{"emerald sanctum"},
		ZoneName:  ZoneNameMatcher("emerald sanctum"),
		Hostiles:  FromMap(EmeraldSanctumHostiles()),
	}

	BlackrockDepthsFactory = &CommonFactory{
		Name:      "Blackrock Depths",
		ZoneNames: []string{"blackrock depths"},
		ZoneName:  ZoneNameMatcher("blackrock depths"),
		Hostiles:  FromMap(BlackrockDepthsHostiles()),
	}

	ScholomanceFactory = &CommonFactory{
		Name:      "Scholomance",
		ZoneNames: []string{"scholomance"},
		ZoneName:  ZoneNameMatcher("scholomance"),
		Hostiles:  FromMap(ScholomanceHostiles()),
	}

	TempleOfAhnQirajFactory = &CommonFactory{
		Name:      "Temple of Ahn'Qiraj",
		ZoneNames: []string{"ahn'qiraj"},
		ZoneName:  ZoneNameMatcher("ahn'qiraj"),
		Hostiles:  FromMap(TempleOfAhnQirajHostiles()),
		Rankings: &rankings.Rankings{
			Speedrun: &rankings.SpeedrunRules{
				Requirements: TempleOfAhnQirajSpeedrunRequirements(),
			},
		},
	}

	RuinsOfAhnQirajFactory = &CommonFactory{
		Name:      "Ruins of Ahn'Qiraj",
		ZoneNames: []string{"ruins of ahn'qiraj"},
		ZoneName:  ZoneNameMatcher("ruins of ahn'qiraj"),
		Hostiles:  FromMap(RuinsOfAhnQirajHostiles()),
		Rankings: &rankings.Rankings{
			Speedrun: &rankings.SpeedrunRules{
				Requirements: RuinsOfAhnQirajSpeedrunRequirements(),
			},
		},
	}

	BlackwingLairFactory = &CommonFactory{
		Name:      "Blackwing Lair",
		ZoneNames: []string{"blackwing lair"},
		ZoneName:  ZoneNameMatcher("blackwing lair"),
		Hostiles:  FromMap(BlackwingLairHostiles()),
		Rankings: &rankings.Rankings{
			Speedrun: &rankings.SpeedrunRules{
				Requirements: BlackwingLairSpeedrunRequirements(),
			},
		},
	}

	NaxxramasFactory = &CommonFactory{
		Name:      "Naxxramas",
		ZoneNames: []string{"naxxramas", "the upper necropolis"},
		ZoneName:  ZoneNameMatcher("naxxramas", "the upper necropolis"),
		Hostiles:  FromMap(NaxxramasHostiles()),
		Rankings: &rankings.Rankings{
			Speedrun: &rankings.SpeedrunRules{
				Requirements: NaxxramasSpeedrunRequirements(),
			},
		},
	}

	StratholmeFactory = &CommonFactory{
		Name:      "Stratholme",
		ZoneNames: []string{"stratholme"},
		ZoneName:  ZoneNameMatcher("stratholme"),
		Hostiles:  FromMap(StratholmeHostiles()),
	}

	BlackMorassFactory = &CommonFactory{
		Name:      "Black Morass",
		ZoneNames: []string{"the black morass"},
		ZoneName:  ZoneNameMatcher("the black morass"),
		Hostiles:  FromMap(TheBlackMorassHostiles()),
	}

	DireMaulFactory = &CommonFactory{
		Name:      "Dire Maul",
		ZoneNames: []string{"dire maul"},
		ZoneName:  ZoneNameMatcher("dire maul"),
		Hostiles:  FromMap(DireMaulHostiles()),
	}

	StormwindVaultFactory = &CommonFactory{
		Name:      "Stormwind Vault",
		ZoneNames: []string{"stormwind vault"},
		ZoneName:  ZoneNameMatcher("stormwind vault"),
		Hostiles:  FromMap(StormwindVaultHostiles()),
	}

	StockadesFactory = &CommonFactory{
		Name:      "Stormwind Stockade",
		ZoneNames: []string{"the stockade"},
		ZoneName:  ZoneNameMatcher("the stockade"),
		Hostiles:  FromMap(StockadeHostiles()),
	}

	SunkenTempleFactory = &CommonFactory{
		Name:      "Sunken Temple",
		ZoneNames: []string{"the temple of atal'hakkar"},
		ZoneName:  ZoneNameMatcher("the temple of atal'hakkar"),
		Hostiles:  FromMap(SunkenTempleHostiles()),
	}

	TimbermawHoldFactory = &CommonFactory{
		Name:      "Timbermaw Hold",
		ZoneNames: []string{"timbermaw hold"},
		ZoneName:  ZoneNameMatcher("timbermaw hold"),
		Hostiles:  FromMap(TimbermawHoldHostiles()),
		Rankings: &rankings.Rankings{
			Speedrun: &rankings.SpeedrunRules{
				Requirements: TimbermawHoldSpeedrunRequirements(),
			},
		},
	}

	FrostmaneHollowFactory = &CommonFactory{
		Name:      "Frostmane Hollow",
		ZoneNames: []string{"frostmane hollow"},
		ZoneName:  ZoneNameMatcher("frostmane hollow"),
		Hostiles:  FromMap(FrostmaneHollowHostiles()),
	}
)
