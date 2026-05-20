package main

// InstanceMeta holds curated metadata for a single dungeon or raid instance.
type InstanceMeta struct {
	MapID     uint32
	Name      string   // Display name, e.g. "Molten Core"
	VarPrefix string   // Go identifier prefix, e.g. "MoltenCore"
	ZoneNames []string // Lowercase zone names for combat log matching
	Expansion string   // "vanilla", "tbc", "wotlk"
	Type      string   // "dungeon" or "raid"
}

// AllInstances is the complete list of dungeon and raid instances from
// the AzerothCore WotLK database. Zone names are sourced from the existing
// Chronicle codebase where available, or derived from the instance name.
//
//nolint:lll
var AllInstances = []InstanceMeta{
	// ========================= VANILLA DUNGEONS =========================
	{33, "Shadowfang Keep", "ShadowfangKeep", []string{"shadowfang keep"}, "vanilla", "dungeon"},
	{34, "The Stockade", "Stockade", []string{"the stockade", "stormwind stockade"}, "vanilla", "dungeon"},
	{36, "Deadmines", "Deadmines", []string{"the deadmines"}, "vanilla", "dungeon"},
	{43, "Wailing Caverns", "WailingCaverns", []string{"wailing caverns"}, "vanilla", "dungeon"},
	{47, "Razorfen Kraul", "RazorfenKraul", []string{"razorfen kraul"}, "vanilla", "dungeon"},
	{48, "Blackfathom Deeps", "BlackfathomDeeps", []string{"blackfathom deeps"}, "vanilla", "dungeon"},
	{70, "Uldaman", "Uldaman", []string{"uldaman"}, "vanilla", "dungeon"},
	{90, "Gnomeregan", "Gnomeregan", []string{"gnomeregan"}, "vanilla", "dungeon"},
	{109, "Sunken Temple", "SunkenTemple", []string{"the temple of atal'hakkar", "sunken temple"}, "vanilla", "dungeon"},
	{129, "Razorfen Downs", "RazorfenDowns", []string{"razorfen downs"}, "vanilla", "dungeon"},
	{189, "Scarlet Monastery", "ScarletMonastery", []string{"scarlet monastery"}, "vanilla", "dungeon"},
	{209, "Zul'Farrak", "ZulFarrak", []string{"zul'farrak"}, "vanilla", "dungeon"},
	{229, "Blackrock Spire", "BlackrockSpire", []string{"blackrock spire"}, "vanilla", "dungeon"},
	{230, "Blackrock Depths", "BlackrockDepths", []string{"blackrock depths"}, "vanilla", "dungeon"},
	{289, "Scholomance", "Scholomance", []string{"scholomance"}, "vanilla", "dungeon"},
	{329, "Stratholme", "Stratholme", []string{"stratholme"}, "vanilla", "dungeon"},
	{349, "Maraudon", "Maraudon", []string{"maraudon"}, "vanilla", "dungeon"},
	{389, "Ragefire Chasm", "RagefireChasm", []string{"ragefire chasm"}, "vanilla", "dungeon"},
	{429, "Dire Maul", "DireMaul", []string{"dire maul"}, "vanilla", "dungeon"},

	// ========================= VANILLA RAIDS =========================
	{249, "Onyxia's Lair", "OnyxiasLair", []string{"onyxia's lair"}, "vanilla", "raid"},
	{309, "Zul'Gurub", "ZulGurub", []string{"zul'gurub"}, "vanilla", "raid"},
	{409, "Molten Core", "MoltenCore", []string{"molten core"}, "vanilla", "raid"},
	{469, "Blackwing Lair", "BlackwingLair", []string{"blackwing lair"}, "vanilla", "raid"},
	{509, "Ruins of Ahn'Qiraj", "RuinsOfAhnQiraj", []string{"ruins of ahn'qiraj"}, "vanilla", "raid"},
	{531, "Temple of Ahn'Qiraj", "TempleOfAhnQiraj", []string{"ahn'qiraj temple", "temple of ahn'qiraj"}, "vanilla", "raid"},

	// ========================= TBC DUNGEONS =========================
	{269, "The Black Morass", "BlackMorass", []string{"the black morass", "opening of the dark portal"}, "tbc", "dungeon"},
	{540, "The Shattered Halls", "ShatteredHalls", []string{"the shattered halls"}, "tbc", "dungeon"},
	{542, "The Blood Furnace", "BloodFurnace", []string{"the blood furnace", "hellfire citadel: the blood furnace"}, "tbc", "dungeon"},
	{543, "Hellfire Ramparts", "HellfireRamparts", []string{"hellfire ramparts"}, "tbc", "dungeon"},
	{545, "The Steamvault", "Steamvault", []string{"the steamvault"}, "tbc", "dungeon"},
	{546, "The Underbog", "Underbog", []string{"the underbog"}, "tbc", "dungeon"},
	{547, "The Slave Pens", "SlavePens", []string{"the slave pens"}, "tbc", "dungeon"},
	{552, "The Arcatraz", "Arcatraz", []string{"the arcatraz"}, "tbc", "dungeon"},
	{553, "The Botanica", "Botanica", []string{"the botanica"}, "tbc", "dungeon"},
	{554, "The Mechanar", "Mechanar", []string{"the mechanar"}, "tbc", "dungeon"},
	{555, "Shadow Labyrinth", "ShadowLabyrinth", []string{"shadow labyrinth"}, "tbc", "dungeon"},
	{556, "Sethekk Halls", "SethekkHalls", []string{"sethekk halls"}, "tbc", "dungeon"},
	{557, "Mana-Tombs", "ManaTombs", []string{"mana-tombs"}, "tbc", "dungeon"},
	{558, "Auchenai Crypts", "AuchenaiCrypts", []string{"auchenai crypts"}, "tbc", "dungeon"},
	{560, "Old Hillsbrad Foothills", "OldHillsbrad", []string{"old hillsbrad foothills"}, "tbc", "dungeon"},
	{585, "Magisters' Terrace", "MagistersTerrace", []string{"magisters' terrace"}, "tbc", "dungeon"},

	// ========================= TBC RAIDS =========================
	{532, "Karazhan", "Karazhan", []string{"karazhan"}, "tbc", "raid"},
	{534, "Hyjal Summit", "HyjalSummit", []string{"hyjal summit", "the battle for mount hyjal"}, "tbc", "raid"},
	{544, "Magtheridon's Lair", "MagtheridonsLair", []string{"magtheridon's lair"}, "tbc", "raid"},
	{548, "Serpentshrine Cavern", "SerpentshrineCavern", []string{"serpentshrine cavern"}, "tbc", "raid"},
	{550, "Tempest Keep", "TempestKeep", []string{"tempest keep", "the eye"}, "tbc", "raid"},
	{564, "Black Temple", "BlackTemple", []string{"black temple"}, "tbc", "raid"},
	{565, "Gruul's Lair", "GruulsLair", []string{"gruul's lair"}, "tbc", "raid"},
	{568, "Zul'Aman", "ZulAman", []string{"zul'aman"}, "tbc", "raid"},
	{580, "Sunwell Plateau", "SunwellPlateau", []string{"sunwell plateau"}, "tbc", "raid"},

	// ========================= WOTLK DUNGEONS =========================
	{574, "Utgarde Keep", "UtgardeKeep", []string{"utgarde keep"}, "wotlk", "dungeon"},
	{575, "Utgarde Pinnacle", "UtgardePinnacle", []string{"utgarde pinnacle"}, "wotlk", "dungeon"},
	{576, "The Nexus", "Nexus", []string{"the nexus"}, "wotlk", "dungeon"},
	{578, "The Oculus", "Oculus", []string{"the oculus", "oculus"}, "wotlk", "dungeon"},
	{595, "Culling of Stratholme", "CullingOfStratholme", []string{"the culling of stratholme"}, "wotlk", "dungeon"},
	{599, "Halls of Stone", "HallsOfStone", []string{"halls of stone"}, "wotlk", "dungeon"},
	{600, "Drak'Tharon Keep", "DrakTharonKeep", []string{"drak'tharon keep"}, "wotlk", "dungeon"},
	{601, "Azjol-Nerub", "AzjolNerub", []string{"azjol-nerub"}, "wotlk", "dungeon"},
	{602, "Halls of Lightning", "HallsOfLightning", []string{"halls of lightning"}, "wotlk", "dungeon"},
	{604, "Gundrak", "Gundrak", []string{"gundrak"}, "wotlk", "dungeon"},
	{608, "Violet Hold", "VioletHold", []string{"the violet hold"}, "wotlk", "dungeon"},
	{619, "Ahn'kahet: The Old Kingdom", "AhnkahetOldKingdom", []string{"ahn'kahet: the old kingdom"}, "wotlk", "dungeon"},
	{632, "Forge of Souls", "ForgeOfSouls", []string{"forge of souls"}, "wotlk", "dungeon"},
	{650, "Trial of the Champion", "TrialOfTheChampion", []string{"trial of the champion"}, "wotlk", "dungeon"},
	{658, "Pit of Saron", "PitOfSaron", []string{"pit of saron"}, "wotlk", "dungeon"},
	{668, "Halls of Reflection", "HallsOfReflection", []string{"halls of reflection"}, "wotlk", "dungeon"},

	// ========================= WOTLK RAIDS =========================
	{533, "Naxxramas", "Naxxramas", []string{"naxxramas"}, "wotlk", "raid"},
	{603, "Ulduar", "Ulduar", []string{"ulduar"}, "wotlk", "raid"},
	{615, "Obsidian Sanctum", "ObsidianSanctum", []string{"the obsidian sanctum"}, "wotlk", "raid"},
	{616, "Eye of Eternity", "EyeOfEternity", []string{"the eye of eternity", "eye of eternity"}, "wotlk", "raid"},
	{624, "Vault of Archavon", "VaultOfArchavon", []string{"vault of archavon"}, "wotlk", "raid"},
	{631, "Icecrown Citadel", "IcecrownCitadel", []string{"icecrown citadel"}, "wotlk", "raid"},
	{649, "Trial of the Crusader", "TrialOfTheCrusader", []string{"trial of the crusader", "trial of the grand crusader"}, "wotlk", "raid"},
	{724, "Ruby Sanctum", "RubySanctum", []string{"the ruby sanctum", "ruby sanctum"}, "wotlk", "raid"},
}
