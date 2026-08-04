package registry

import (
	"testing"

	"github.com/Emyrk/chronicle/database"
	"github.com/stretchr/testify/require"
)

func TestWrathRegistryReplacesClassicOnyxia(t *testing.T) {
	t.Parallel()

	tbc := RegistryForFlavor(nil, database.WoWFlavor{database.FlavorTBC}).EntryByName("Onyxia's Lair")
	require.NotNil(t, tbc)
	require.NotNil(t, tbc.SpeedrunRules)
	require.Equal(t, []uint32{10184, 45133}, tbc.SpeedrunRules.Requirements[0].EntryIDs)

	wrath := RegistryForFlavor(nil, database.WoWFlavor{database.FlavorWrath}).EntryByName("Onyxia's Lair")
	require.NotNil(t, wrath)
	require.NotNil(t, wrath.SpeedrunRules)
	require.Nil(t, wrath.SpeedrunRules.LevelRange)
	require.Equal(t, []uint32{10184}, wrath.SpeedrunRules.Requirements[0].EntryIDs)
}

func TestInstanceDetailsBossCount(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name      string
		flavor    database.WoWFlavor
		instance  string
		bossCount *int
	}{
		{name: "vanilla onyxia", flavor: database.WoWFlavor{database.FlavorVanilla}, instance: "Onyxia's Lair", bossCount: intPtr(1)},
		{name: "turtle onyxia", flavor: database.WoWFlavor{database.FlavorTurtle}, instance: "Onyxia's Lair", bossCount: intPtr(2)},
		{name: "epoch onyxia", flavor: database.WoWFlavor{database.FlavorEpoch}, instance: "Onyxia's Lair", bossCount: intPtr(3)},
		{name: "naxxramas groups multi-unit encounters", flavor: database.WoWFlavor{database.FlavorVanilla}, instance: "Naxxramas", bossCount: intPtr(15)},
		{name: "gruul groups council members", flavor: database.WoWFlavor{database.FlavorTBC}, instance: "Gruul's Lair", bossCount: intPtr(2)},
		{name: "utgarde keep groups skarvald and dalronn", flavor: database.WoWFlavor{database.FlavorWrath}, instance: "Utgarde Keep", bossCount: intPtr(3)},
		{name: "instance without speedrun rules", flavor: database.WoWFlavor{database.FlavorVanilla}, instance: "Shadowfang Keep"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			reg := RegistryForFlavor(nil, tc.flavor)
			for _, detail := range reg.AllInstanceDetails() {
				if detail.Name == tc.instance {
					require.Equal(t, tc.bossCount, detail.BossCount)
					return
				}
			}
			t.Fatalf("instance %q not found", tc.instance)
		})
	}
}

// Multi-unit fights must share one EncounterName, otherwise every unit opens
// its own encounter and the log reports more bosses than the instance has.
func TestWrathMultiUnitEncountersShareOneName(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		instance   string
		encounter  string
		unitEntry  uint32
		otherEntry uint32
	}{
		{instance: "Utgarde Keep", encounter: "Skarvald & Dalronn", unitEntry: 24200, otherEntry: 24201},
		{instance: "Trial of the Crusader", encounter: "Northrend Beasts", unitEntry: 34796, otherEntry: 34797},
		{instance: "Trial of the Crusader", encounter: "Twin Val'kyr", unitEntry: 34496, otherEntry: 34497},
		{instance: "Ulduar", encounter: "Assembly of Iron", unitEntry: 32857, otherEntry: 32867},
		{instance: "Ulduar", encounter: "Freya", unitEntry: 32906, otherEntry: 32913},
		{instance: "Ulduar", encounter: "Mimiron", unitEntry: 33244, otherEntry: 33432},
	} {
		t.Run(tc.encounter, func(t *testing.T) {
			t.Parallel()

			entry := RegistryForFlavor(nil, database.WoWFlavor{database.FlavorWrath}).EntryByName(tc.instance)
			require.NotNil(t, entry)

			for _, entryID := range []uint32{tc.unitEntry, tc.otherEntry} {
				identity, ok := entry.HostileEntries[entryID]
				require.True(t, ok, "entry %d missing", entryID)
				require.True(t, identity.Boss, "entry %d should be a boss", entryID)
				require.Equal(t, tc.encounter, identity.EncounterName)
			}
		})
	}
}

// Scripted triggers have no health and are never killed, so counting them as
// bosses leaves an encounter that can never complete.
func TestUlduarTriggersAreNotBosses(t *testing.T) {
	t.Parallel()

	entry := RegistryForFlavor(nil, database.WoWFlavor{database.FlavorWrath}).EntryByName("Ulduar")
	require.NotNil(t, entry)

	for _, entryID := range []uint32{32892, 33054, 33725, 33264, 33378} {
		identity, ok := entry.HostileEntries[entryID]
		require.True(t, ok, "entry %d missing", entryID)
		require.False(t, identity.Boss, "entry %d (%s) should not be a boss", entryID, identity.Name)
	}
}

func intPtr(value int) *int {
	return &value
}
