package character_test

import (
	"testing"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/character"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/period"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/unitdb"
	"github.com/stretchr/testify/require"
)

func TestThaddiusParty_BridgesAddsIntoBossPhase(t *testing.T) {
	t.Parallel()

	chars := character.NewCharacters(unitdb.New())

	player := guid.GUID(0x1)
	thaddius := creatureGUID(15928, 0x1)
	stalagg := creatureGUID(15929, 0x2)
	feugen := creatureGUID(15930, 0x3)

	base := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	msgs := []messages.Message{
		damage(base, player, feugen),
		damage(base.Add(1*time.Second), player, stalagg),
		slain(base.Add(2*time.Second), player, feugen),
		slain(base.Add(3*time.Second), player, stalagg),
	}

	for _, msg := range msgs {
		_, err := chars.Process(msg)
		require.NoError(t, err)
	}

	feugenChar, ok := chars.Get(feugen)
	require.True(t, ok)
	require.True(t, feugenChar.IsActive(), "feugen should stay active after pending death")

	stalaggChar, ok := chars.Get(stalagg)
	require.True(t, ok)
	require.True(t, stalaggChar.IsActive(), "stalagg should stay active after pending death")

	_, err := chars.Process(damage(base.Add(4*time.Second), player, thaddius))
	require.NoError(t, err)
	_, err = chars.Process(damage(base.Add(5*time.Second), player, thaddius))
	require.NoError(t, err)

	require.False(t, feugenChar.IsActive())
	require.False(t, stalaggChar.IsActive())

	feugenPeriods := feugenChar.Periods()
	require.Len(t, feugenPeriods, 1)
	require.Equal(t, period.EndStateSlain, feugenPeriods[0].EndState)
	require.Equal(t, "thaddius_phase_transition", feugenPeriods[0].End.Reason)

	stalaggPeriods := stalaggChar.Periods()
	require.Len(t, stalaggPeriods, 1)
	require.Equal(t, period.EndStateSlain, stalaggPeriods[0].EndState)
	require.Equal(t, "thaddius_phase_transition", stalaggPeriods[0].End.Reason)
}

func TestThaddiusParty_TransitionTimeoutFinalizesAdds(t *testing.T) {
	t.Parallel()

	chars := character.NewCharacters(unitdb.New())

	player := guid.GUID(0x1)
	feugen := creatureGUID(15930, 0x1)
	dummyTarget := creatureGUID(16017, 0x2)

	base := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	_, err := chars.Process(damage(base, player, feugen))
	require.NoError(t, err)
	_, err = chars.Process(slain(base.Add(1*time.Second), player, feugen))
	require.NoError(t, err)

	feugenChar, ok := chars.Get(feugen)
	require.True(t, ok)
	require.True(t, feugenChar.IsActive(), "feugen should still be active while death is pending")

	_, err = chars.Process(damage(base.Add(25*time.Second), player, dummyTarget))
	require.NoError(t, err)

	require.False(t, feugenChar.IsActive())
	periods := feugenChar.Periods()
	require.Len(t, periods, 1)
	require.Equal(t, period.EndStateSlain, periods[0].EndState)
	require.Equal(t, "thaddius_transition_timeout", periods[0].End.Reason)
}

func TestGothikParty_StartsOnAnyAdd_WithSinglePendingAnchor(t *testing.T) {
	t.Parallel()

	chars := character.NewCharacters(unitdb.New())

	player := guid.GUID(0x1)
	unrelentingTrainee := creatureGUID(16124, 0x10)
	unrelentingDeathknight := creatureGUID(16125, 0x11)
	spectralTrainee := creatureGUID(16127, 0x12)

	base := time.Date(2026, time.January, 2, 0, 0, 0, 0, time.UTC)
	msgs := []messages.Message{
		damage(base, player, unrelentingTrainee),
		slain(base.Add(1*time.Second), player, unrelentingTrainee),
		damage(base.Add(10*time.Second), player, unrelentingDeathknight),
		slain(base.Add(11*time.Second), player, unrelentingDeathknight),
		damage(base.Add(40*time.Second), player, spectralTrainee),
		slain(base.Add(41*time.Second), player, spectralTrainee),
	}

	for _, msg := range msgs {
		_, err := chars.Process(msg)
		require.NoError(t, err)
	}

	anchorChar, ok := chars.Get(unrelentingTrainee)
	require.True(t, ok)
	require.True(t, anchorChar.IsActive(), "expected one add to remain active as pending-death anchor")

	deathknightChar, ok := chars.Get(unrelentingDeathknight)
	require.True(t, ok)
	require.False(t, deathknightChar.IsActive())

	spectralChar, ok := chars.Get(spectralTrainee)
	require.True(t, ok)
	require.False(t, spectralChar.IsActive())

	activeAdds := 0
	for _, id := range []guid.GUID{unrelentingTrainee, unrelentingDeathknight, spectralTrainee} {
		char, ok := chars.Get(id)
		require.True(t, ok)
		if char.IsActive() {
			activeAdds++
		}
	}
	require.Equal(t, 1, activeAdds, "expected exactly one add anchor to stay active")

	periods := deathknightChar.Periods()
	require.Len(t, periods, 1)
	require.Equal(t, period.EndStateSlain, periods[0].EndState)
	require.Equal(t, "gothik_pending_add", periods[0].End.Reason)
}

func TestGothikParty_EndsOnBossDeath_FlushesPendingAdds(t *testing.T) {
	t.Parallel()

	chars := character.NewCharacters(unitdb.New())

	player := guid.GUID(0x1)
	gothik := creatureGUID(16060, 0x20)
	unrelentingTrainee := creatureGUID(16124, 0x21)

	base := time.Date(2026, time.January, 2, 1, 0, 0, 0, time.UTC)
	msgs := []messages.Message{
		damage(base, player, unrelentingTrainee),
		slain(base.Add(1*time.Second), player, unrelentingTrainee),
		damage(base.Add(20*time.Second), player, gothik),
		slain(base.Add(21*time.Second), player, gothik),
	}

	for _, msg := range msgs {
		_, err := chars.Process(msg)
		require.NoError(t, err)
	}

	addChar, ok := chars.Get(unrelentingTrainee)
	require.True(t, ok)
	require.False(t, addChar.IsActive(), "pending add should be finalized when Gothik dies")

	addPeriods := addChar.Periods()
	require.Len(t, addPeriods, 1)
	require.Equal(t, period.EndStateSlain, addPeriods[0].EndState)
	require.Equal(t, "gothik_boss_slain", addPeriods[0].End.Reason)

	bossChar, ok := chars.Get(gothik)
	require.True(t, ok)
	require.False(t, bossChar.IsActive())

	bossPeriods := bossChar.Periods()
	require.Len(t, bossPeriods, 1)
	require.Equal(t, period.EndStateSlain, bossPeriods[0].EndState)
	require.Equal(t, character.ReasonSlain, bossPeriods[0].End.Reason)
}

func TestGothikParty_TimesOutWithoutBossDeath(t *testing.T) {
	t.Parallel()

	chars := character.NewCharacters(unitdb.New())

	player := guid.GUID(0x1)
	unrelentingTrainee := creatureGUID(16124, 0x30)
	spectralDeathknight := creatureGUID(16148, 0x31)
	dummyTarget := creatureGUID(16017, 0x32)

	base := time.Date(2026, time.January, 2, 2, 0, 0, 0, time.UTC)
	msgs := []messages.Message{
		damage(base, player, unrelentingTrainee),
		slain(base.Add(1*time.Second), player, unrelentingTrainee),
		damage(base.Add(30*time.Second), player, spectralDeathknight),
		slain(base.Add(31*time.Second), player, spectralDeathknight),
		damage(base.Add(95*time.Second), player, dummyTarget),
	}

	for _, msg := range msgs {
		_, err := chars.Process(msg)
		require.NoError(t, err)
	}

	anchorChar, ok := chars.Get(unrelentingTrainee)
	require.True(t, ok)
	require.False(t, anchorChar.IsActive(), "anchor should timeout without ongoing Gothik activity")

	anchorPeriods := anchorChar.Periods()
	require.Len(t, anchorPeriods, 1)
	require.Equal(t, period.EndStateTimeout, anchorPeriods[0].EndState)
}

func TestNewGothikParty_MatchesOnlyExpectedEntries(t *testing.T) {
	t.Parallel()

	chars := character.NewCharacters(unitdb.New())

	for _, entry := range []uint32{16060, 16124, 16125, 16126, 16127, 16148, 16149, 16150} {
		id := creatureGUID(entry, entry)
		require.True(t, id.IsCreature())
		gotEntry, ok := id.GetEntry()
		require.True(t, ok)
		require.Equal(t, entry, gotEntry)

		created, ok := character.NewGothikRoom(id, chars)
		require.True(t, ok)
		require.NotNil(t, created)
	}

	created, ok := character.NewGothikRoom(creatureGUID(16028, 0x99), chars)
	require.False(t, ok)
	require.Nil(t, created)

	created, ok = character.NewGothikRoom(guid.GUID(0x1), chars)
	require.False(t, ok)
	require.Nil(t, created)
}

func TestNewThaddiusParty_MatchesOnlyExpectedEntries(t *testing.T) {
	t.Parallel()

	chars := character.NewCharacters(unitdb.New())

	for _, entry := range []uint32{15928, 15929, 15930} {
		id := creatureGUID(entry, entry)
		require.True(t, id.IsCreature())
		gotEntry, ok := id.GetEntry()
		require.True(t, ok)
		require.Equal(t, entry, gotEntry)

		created, ok := character.NewThaddiusParty(id, chars)
		require.True(t, ok)
		require.NotNil(t, created)
	}

	created, ok := character.NewThaddiusParty(creatureGUID(16028, 0x99), chars)
	require.False(t, ok)
	require.Nil(t, created)

	created, ok = character.NewThaddiusParty(guid.GUID(0x1), chars)
	require.False(t, ok)
	require.Nil(t, created)
}

func creatureGUID(entry uint32, seed uint32) guid.GUID {
	return guid.GUID(0xF130000000000000 | uint64(entry&0xFFFFFF)<<24 | uint64(seed&0xFFFFFF))
}

func damage(ts time.Time, caster guid.GUID, target guid.GUID) *messages.Damage {
	return &messages.Damage{
		MessageBase: messages.Base(ts),
		Caster:      &caster,
		Target:      target,
		Amount:      1,
	}
}

func slain(ts time.Time, killer guid.GUID, victim guid.GUID) *messages.Slain {
	return &messages.Slain{
		MessageBase: messages.Base(ts),
		Victim:      victim,
		Killer:      &killer,
	}
}
