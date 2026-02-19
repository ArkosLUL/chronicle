package instances

var (
	Deadmines = (&CommonFactory{
		Name:     "Deadmines",
		ZoneName: "the deadmines",
		Hostiles: FromMap(DeadminesHostiles()),
	}).New

	ScarletMonasteryCathedral = (&CommonFactory{
		Name:     "Scarlet Monastery Cathedral",
		ZoneName: "scarlet monastery cathedral",
		Hostiles: FromMap(CathedralHostiles()),
	}).New

	ScarletMonasteryLibrary = (&CommonFactory{
		Name:     "Scarlet Monastery Library",
		ZoneName: "scarlet monastery library",
		Hostiles: FromMap(SMLibraryHostiles()),
	}).New

	BlackrockSpire = (&CommonFactory{
		Name:     "Blackrock Spire",
		ZoneName: "blackrock spire",
		Hostiles: FromMap(BlackrockSpireHostiles()),
	}).New

	MoltenCore = (&CommonFactory{
		Name:     "Molten Core",
		ZoneName: "molten core",
		Hostiles: FromMap(MoltenCoreHostiles()),
	}).New

	TowerOfKarazhan = (&CommonFactory{
		Name:     "Tower of Karazhan",
		ZoneName: "tower of karazhan",
		Hostiles: FromMap(TowerOfKarazhanHostiles()),
	}).New

	Onyxia = (&CommonFactory{
		Name:     "Onyxia's Lair",
		ZoneName: "onyxia's lair",
		Hostiles: FromMap(OnyxiaHostiles()),
	}).New

	RagefireChasm = (&CommonFactory{
		Name:     "Ragefire Chasm",
		ZoneName: "ragefire chasm",
		Hostiles: FromMap(RagefireChasmHostiles()),
	}).New

	ZulGurub = (&CommonFactory{
		Name:     "Zul'Gurub",
		ZoneName: "zul'gurub",
		Hostiles: FromMap(ZulGurubHostiles()),
	}).New

	EmeraldSanctum = (&CommonFactory{
		Name:     "Emerald Sanctum",
		ZoneName: "emerald sanctum",
		Hostiles: FromMap(EmeraldSanctumHostiles()),
	}).New

	BlackrockDepths = (&CommonFactory{
		Name:     "Blackrock Depths",
		ZoneName: "blackrock depths",
		Hostiles: FromMap(BlackrockDepthsHostiles()),
	}).New

	Scholomance = (&CommonFactory{
		Name:     "Scholomance",
		ZoneName: "scholomance",
		Hostiles: FromMap(ScholomanceHostiles()),
	}).New

	TempleOfAhnQiraj = (&CommonFactory{
		Name:     "Temple of Ahn'Qiraj",
		ZoneName: "ahn'qiraj",
		Hostiles: FromMap(TempleOfAhnQirajHostiles()),
	}).New

	BlackwingLair = (&CommonFactory{
		Name:     "Blackwing Lair",
		ZoneName: "blackwing lair",
		Hostiles: FromMap(BlackwingLairHostiles()),
	}).New

	Naxxramas = (&CommonFactory{
		Name:     "Naxxramas",
		ZoneName: "naxxramas",
		Hostiles: FromMap(NaxxramasHostiles()),
	}).New
)
