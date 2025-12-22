package instances

func FromMap(m map[uint32]Identity) func() *Identifier {
	return func() *Identifier {
		return NewIdentifier(m)
	}
}

func CathedralHostiles() map[uint32]Identity {
	hostile := make(map[uint32]Identity)
	for k := range map[uint32]string{
		4540: "Scarlet Monk",
		4299: "Scarlet Chaplain",
		4301: "Scarlet Centurion",
		4302: "Scarlet Champion",
		4300: "Scarlet Wizard",
		3976: "Scarlet Commander Mograine",
		3977: "High Inquisitor Whitemane",
		4542: "High Inquisitor Fairbanks",
		4295: "Scarlet Myrmidon",

		4298: "Scarlet Defender", // Is this in the instance?
	} {
		hostile[k] = Identity{Hostile: true}
	}
	return hostile
}

func BlackrockSpireHostiles() map[uint32]Identity {
	hostile := make(map[uint32]Identity)
	for k := range map[uint32]string{
		9816:  "Pyroguard Emberseer",
		10161: "Rookery Whelp",
		10742: "Blackhand Dragon Handler",
		9096:  "Rage Talon Dragonspawn",
		9817:  "Blackhand Dreadweaver",
		10442: "Chromatic Whelp",
		10318: "Blackhand Assassin",
		10430: "The Beast",
		10814: "Chromatic Elite Guard",
		9818:  "Blackhand Summoner",
		10680: "Summoned Blackhand Dreadweaver",
		10681: "Summoned Blackhand Veteran",
		10447: "Chromatic Dragonspawn",
		10429: "Warchief Rend Blackhand",
		10339: "Gyth", // Blackhand mount
		10366: "Rage Talon Dragon Guard",
		10371: "Rage Talon Captain",
		10363: "General Drakkisath",
		9097:  "Scarshield Legionnaire",
		10316: "Blackhand Incarcerator",
		10083: "Rage Talon Flamescale",
		10317: "Blackhand Elite",
		10372: "Rage Talon Fire Tongue",
		10319: "Blackhand Iron Guard",
		9819:  "Blackhand Veteran",
	} {
		hostile[k] = Identity{Hostile: true}
	}
	return hostile
}

func MoltenCoreHostiles() map[uint32]Identity {
	hostile := make(map[uint32]Identity)
	for k := range map[uint32]string{
		52150: "Shadowforge Guardian",
		57643: "Image of Sorcerer-Thane Thaurissan",
		12101: "Lava Surger",
		12100: "Lava Reaver",
		12098: "Sulfuron Harbinger",
		11672: "Core Rager",
		11663: "Flamewaker Healer",
		12018: "Majordomo Executus",
		11658: "Molten Giant",
		12057: "Garr",
		65020: "Basalthar",
		52152: "Shadowforge Blazeweaver",
		11666: "Firewalker",
		11665: "Lava Annihilator",
		11659: "Molten Destroyer",
		12265: "Lava Spawn",
		12056: "Baron Geddon",
		11662: "Flamewaker Priest",
		65021: "Smoldaris",
		11667: "Flameguard",
		11664: "Flamewaker Elite",
		12099: "Firesworn",
		12076: "Lava Elemental",
		12143: "Son of Flame",
		11988: "Golemagg the Incinerator",
		52151: "Shadowforge Hierophant",
		12264: "Shazzrah",
		11668: "Firelord",
		57642: "Sorcerer-Thane Thaurissan",
		11502: "Ragnaros",
		11673: "Ancient Core Hound",
		11669: "Flame Imp",
		52147: "Large Incendic Egg",
		11671: "Core Hound",
		52145: "Incindis",
		12119: "Flamewaker Protector",
		12118: "Lucifron",
		11982: "Magmadar",

		// What the heck are these?
		52146: "Small Incendic Egg",
		52149: "Flameskin Incendosaur",
		52148: "Spawn of Incindis",
	} {
		hostile[k] = Identity{Hostile: true}
	}
	return hostile
}

func TowerOfKarazhanHostiles() map[uint32]Identity {
	hostile := make(map[uint32]Identity)
	for k := range map[uint32]string{
		61194: "Shadowbane Ragefang",
		61222: "Lord Blackwald II",
		61208: "Skitterweb Venomfang",
		61224: "Grizikil",
		61211: "Shadowbane Glutton",
		14881: "Spider",
		61209: "Skitterweb Leaper",
		61207: "Skitterweb Darkfang",
		61210: "Phantom Cook",
		61203: "Dark Rider Apprentice",
		61197: "Grellkin Channeler",
		61196: "Grellkin Primalist",
		61206: "Skitterweb Crawler",
		30008: "Skitterweb Egg",
		61199: "Shattercage Magiskull",
		61202: "Haunted Blacksmith",
		61204: "Dark Rider Champion",
		61221: "Brood Queen Araxxna",
		61198: "Shattercage Spearman",
		61192: "Shadowbane Darkcaster",
		61191: "Shadowbane Alpha",
		61223: "Clawlord Howlfang",
		61195: "Grellkin Shadow Weaver",
		61225: "Moroes",
		61200: "Phantom Guardsman",
		61205: "Phantom Servant",
		61193: "Shadowbane Ambusher",
	} {
		hostile[k] = Identity{Hostile: true}
	}
	return hostile
}

func OnyxiaHostiles() map[uint32]Identity {
	hostile := make(map[uint32]Identity)
	for k := range map[uint32]string{
		12129: "Onyxian Warder",
		10184: "Onyxia",
		11262: "Onyxian Whelp",
	} {
		hostile[k] = Identity{Hostile: true}
	}
	return hostile
}
