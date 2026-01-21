package character

import (
	"testing"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/period"
	"github.com/stretchr/testify/require"
	"golang.org/x/xerrors"
)

var _ Character = (*idOnlyCharacter)(nil)

// idOnlyCharacter is a minimal implementation of Character for testing ordering
type idOnlyCharacter struct {
	id guid.GUID
}

func (m *idOnlyCharacter) ID() guid.GUID                           { return m.id }
func (m *idOnlyCharacter) String() string                          { return m.id.String() }
func (m *idOnlyCharacter) Process(messages.Message) error          { return nil }
func (m *idOnlyCharacter) Periods() []period.Period                { return nil }
func (m *idOnlyCharacter) RecentlySlain(messages.Message) bool     { return false }
func (m *idOnlyCharacter) IsActive() bool                          { return false }
func (m *idOnlyCharacter) CurrentPeriod() (period.Period, bool)    { return period.Period{}, false }
func (m2 *idOnlyCharacter) Died(reason string, m messages.Message) {}

func newMockCharacter(id uint64) *idOnlyCharacter {
	return &idOnlyCharacter{id: guid.GUID(id)}
}

func TestNewOrdererCharacters(t *testing.T) {
	t.Parallel()

	oc := NewOrdererCharacters()
	require.NotNil(t, oc)
	require.NotNil(t, oc.characters)
	require.NotNil(t, oc.ordered)
	require.Empty(t, oc.characters)
	require.Empty(t, oc.ordered)
}

func TestOrdererCharacters_Add_SingleCharacter(t *testing.T) {
	t.Parallel()

	oc := NewOrdererCharacters()
	char := newMockCharacter(100)

	oc.Add(char)

	require.Len(t, oc.characters, 1)
	require.Len(t, oc.ordered, 1)
	require.Equal(t, guid.GUID(100), oc.ordered[0])
	require.Equal(t, char, oc.characters[guid.GUID(100)])
}

func TestOrdererCharacters_Add_DuplicateCharacter(t *testing.T) {
	t.Parallel()

	oc := NewOrdererCharacters()
	char1 := newMockCharacter(100)
	char2 := newMockCharacter(100) // Same ID

	oc.Add(char1)
	oc.Add(char2)

	// Should not add duplicate
	require.Len(t, oc.characters, 1)
	require.Len(t, oc.ordered, 1)
	// Should keep the first one
	require.Equal(t, char1, oc.characters[guid.GUID(100)])
}

func TestOrdererCharacters_Add_MaintainsOrder_Ascending(t *testing.T) {
	t.Parallel()

	oc := NewOrdererCharacters()

	// Add in ascending order
	oc.Add(newMockCharacter(100))
	oc.Add(newMockCharacter(200))
	oc.Add(newMockCharacter(300))

	require.Len(t, oc.ordered, 3)
	require.Equal(t, guid.GUID(100), oc.ordered[0])
	require.Equal(t, guid.GUID(200), oc.ordered[1])
	require.Equal(t, guid.GUID(300), oc.ordered[2])
}

func TestOrdererCharacters_Add_MaintainsOrder_Descending(t *testing.T) {
	t.Parallel()

	oc := NewOrdererCharacters()

	// Add in descending order - should still be sorted ascending
	oc.Add(newMockCharacter(300))
	oc.Add(newMockCharacter(200))
	oc.Add(newMockCharacter(100))

	require.Len(t, oc.ordered, 3)
	require.Equal(t, guid.GUID(100), oc.ordered[0])
	require.Equal(t, guid.GUID(200), oc.ordered[1])
	require.Equal(t, guid.GUID(300), oc.ordered[2])
}

func TestOrdererCharacters_Add_MaintainsOrder_Random(t *testing.T) {
	t.Parallel()

	oc := NewOrdererCharacters()

	// Add in random order
	oc.Add(newMockCharacter(500))
	oc.Add(newMockCharacter(100))
	oc.Add(newMockCharacter(300))
	oc.Add(newMockCharacter(200))
	oc.Add(newMockCharacter(400))

	require.Len(t, oc.ordered, 5)
	require.Equal(t, guid.GUID(100), oc.ordered[0])
	require.Equal(t, guid.GUID(200), oc.ordered[1])
	require.Equal(t, guid.GUID(300), oc.ordered[2])
	require.Equal(t, guid.GUID(400), oc.ordered[3])
	require.Equal(t, guid.GUID(500), oc.ordered[4])
}

func TestOrdererCharacters_Add_MaintainsOrder_WithDuplicates(t *testing.T) {
	t.Parallel()

	oc := NewOrdererCharacters()

	oc.Add(newMockCharacter(300))
	oc.Add(newMockCharacter(100))
	oc.Add(newMockCharacter(300)) // Duplicate
	oc.Add(newMockCharacter(200))
	oc.Add(newMockCharacter(100)) // Duplicate

	require.Len(t, oc.ordered, 3)
	require.Equal(t, guid.GUID(100), oc.ordered[0])
	require.Equal(t, guid.GUID(200), oc.ordered[1])
	require.Equal(t, guid.GUID(300), oc.ordered[2])
}

func TestOrdererCharacters_Get(t *testing.T) {
	t.Parallel()

	oc := NewOrdererCharacters()
	char := newMockCharacter(100)
	oc.Add(char)

	// Found
	got, ok := oc.Get(guid.GUID(100))
	require.True(t, ok)
	require.Equal(t, char, got)

	// Not found
	got, ok = oc.Get(guid.GUID(999))
	require.False(t, ok)
	require.Nil(t, got)
}

func TestOrdererCharacters_Set(t *testing.T) {
	t.Parallel()

	oc := NewOrdererCharacters()
	char1 := newMockCharacter(100)
	char2 := newMockCharacter(100) // Same ID, different instance

	// Set new character
	oc.Add(char1)
	require.Equal(t, 1, oc.Len())

	got, _ := oc.Get(guid.GUID(100))
	require.Equal(t, char1, got)

	// Set replaces existing
	oc.Add(char2)
	require.Equal(t, 1, oc.Len()) // Still only 1

	got, _ = oc.Get(guid.GUID(100))
	require.Equal(t, char2, got) // Updated to char2
}

func TestOrdererCharacters_ForEach(t *testing.T) {
	t.Parallel()

	oc := NewOrdererCharacters()
	oc.Add(newMockCharacter(300))
	oc.Add(newMockCharacter(100))
	oc.Add(newMockCharacter(200))

	var visited []guid.GUID
	err := oc.ForEach(func(c Character) error {
		visited = append(visited, c.ID())
		return nil
	})

	require.NoError(t, err)
	// Should be in sorted order
	require.Equal(t, []guid.GUID{100, 200, 300}, visited)
}

func TestOrdererCharacters_ForEach_StopsOnError(t *testing.T) {
	t.Parallel()

	oc := NewOrdererCharacters()
	oc.Add(newMockCharacter(100))
	oc.Add(newMockCharacter(200))
	oc.Add(newMockCharacter(300))

	expectedErr := xerrors.New("test error")
	var visited []guid.GUID
	err := oc.ForEach(func(c Character) error {
		visited = append(visited, c.ID())
		if c.ID() == guid.GUID(200) {
			return expectedErr
		}
		return nil
	})

	require.ErrorIs(t, err, expectedErr)
	require.Equal(t, []guid.GUID{100, 200}, visited) // Stopped at 200
}

func TestOrdererCharacters_Len(t *testing.T) {
	t.Parallel()

	oc := NewOrdererCharacters()
	require.Equal(t, 0, oc.Len())

	oc.Add(newMockCharacter(100))
	require.Equal(t, 1, oc.Len())

	oc.Add(newMockCharacter(200))
	require.Equal(t, 2, oc.Len())

	oc.Add(newMockCharacter(100)) // Duplicate
	require.Equal(t, 2, oc.Len()) // Still 2
}

func TestOrdererCharacters_Map(t *testing.T) {
	t.Parallel()

	oc := NewOrdererCharacters()
	char1 := newMockCharacter(100)
	char2 := newMockCharacter(200)
	oc.Add(char1)
	oc.Add(char2)

	m := oc.Map()
	require.Len(t, m, 2)
	require.Equal(t, char1, m[guid.GUID(100)])
	require.Equal(t, char2, m[guid.GUID(200)])
}
