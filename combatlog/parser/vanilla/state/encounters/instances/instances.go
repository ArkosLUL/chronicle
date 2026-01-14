package instances

var (
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
)
