package instances

var (
	Deadmines = (&CommonFactory{
		Name:     "Deadmines",
		ZoneName: ZoneNameMatcher("the deadmines"),
		Hostiles: FromMap(DeadminesHostiles()),
	}).New

	WailingCaverns = (&CommonFactory{
		Name:     "Wailing Caverns",
		ZoneName: ZoneNameMatcher("wailing caverns"),
		Hostiles: FromMap(WailingCavernsHostiles()),
	}).New

	RazorfenKraul = (&CommonFactory{
		Name:     "Razorfen Kraul",
		ZoneName: ZoneNameMatcher("razorfen kraul"),
		Hostiles: FromMap(RazorfenKraulHostiles()),
	}).New

	ScarletMonasteryCathedral = (&CommonFactory{
		Name:     "Scarlet Monastery Cathedral",
		ZoneName: ZoneNameMatcher("scarlet monastery cathedral"),
		Hostiles: FromMap(CathedralHostiles()),
	}).New

	ScarletMonasteryLibrary = (&CommonFactory{
		Name:     "Scarlet Monastery Library",
		ZoneName: ZoneNameMatcher("scarlet monastery library"),
		Hostiles: FromMap(SMLibraryHostiles()),
	}).New

	BlackrockSpire = (&CommonFactory{
		Name:     "Blackrock Spire",
		ZoneName: ZoneNameMatcher("blackrock spire"),
		Hostiles: FromMap(BlackrockSpireHostiles()),
	}).New

	MoltenCore = (&CommonFactory{
		Name:     "Molten Core",
		ZoneName: ZoneNameMatcher("molten core"),
		Hostiles: FromMap(MoltenCoreHostiles()),
	}).New

	TowerOfKarazhan = (&CommonFactory{
		Name:     "Tower of Karazhan",
		ZoneName: ZoneNameMatcher("tower of karazhan", "the rock of desolation"),
		Hostiles: FromMap(TowerOfKarazhanHostiles()),
	}).New

	Onyxia = (&CommonFactory{
		Name:     "Onyxia's Lair",
		ZoneName: ZoneNameMatcher("onyxia's lair"),
		Hostiles: FromMap(OnyxiaHostiles()),
	}).New

	RagefireChasm = (&CommonFactory{
		Name:     "Ragefire Chasm",
		ZoneName: ZoneNameMatcher("ragefire chasm"),
		Hostiles: FromMap(RagefireChasmHostiles()),
	}).New

	ZulGurub = (&CommonFactory{
		Name:     "Zul'Gurub",
		ZoneName: ZoneNameMatcher("zul'gurub"),
		Hostiles: FromMap(ZulGurubHostiles()),
	}).New

	EmeraldSanctum = (&CommonFactory{
		Name:     "Emerald Sanctum",
		ZoneName: ZoneNameMatcher("emerald sanctum"),
		Hostiles: FromMap(EmeraldSanctumHostiles()),
	}).New

	BlackrockDepths = (&CommonFactory{
		Name:     "Blackrock Depths",
		ZoneName: ZoneNameMatcher("blackrock depths"),
		Hostiles: FromMap(BlackrockDepthsHostiles()),
	}).New

	Scholomance = (&CommonFactory{
		Name:     "Scholomance",
		ZoneName: ZoneNameMatcher("scholomance"),
		Hostiles: FromMap(ScholomanceHostiles()),
	}).New

	TempleOfAhnQiraj = (&CommonFactory{
		Name:     "Temple of Ahn'Qiraj",
		ZoneName: ZoneNameMatcher("ahn'qiraj"),
		Hostiles: FromMap(TempleOfAhnQirajHostiles()),
	}).New

	BlackwingLair = (&CommonFactory{
		Name:     "Blackwing Lair",
		ZoneName: ZoneNameMatcher("blackwing lair"),
		Hostiles: FromMap(BlackwingLairHostiles()),
	}).New

	Naxxramas = (&CommonFactory{
		Name:     "Naxxramas",
		ZoneName: ZoneNameMatcher("naxxramas", "the upper necropolis"),
		Hostiles: FromMap(NaxxramasHostiles()),
	}).New

	Stratholme = (&CommonFactory{
		Name:     "stratholme",
		ZoneName: ZoneNameMatcher("stratholme"),
		Hostiles: FromMap(StratholmeHostiles()),
	}).New
)
