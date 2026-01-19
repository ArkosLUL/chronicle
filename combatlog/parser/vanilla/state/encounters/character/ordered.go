package character

import (
	"sort"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
)

type OrdererCharacters struct {
	characters map[guid.GUID]Character
	ordered    []guid.GUID
}

func NewOrdererCharacters() *OrdererCharacters {
	return &OrdererCharacters{
		characters: make(map[guid.GUID]Character),
		ordered:    make([]guid.GUID, 0),
	}
}

func (o *OrdererCharacters) Get(id guid.GUID) (Character, bool) {
	char, exists := o.characters[id]
	return char, exists
}

func (o *OrdererCharacters) ForEach(f func(Character) error) error {
	for _, id := range o.ordered {
		if err := f(o.characters[id]); err != nil {
			return err
		}
	}
	return nil
}

// Map returns the underlying map for direct access.
// Use sparingly - prefer Get, Set, ForEach when possible.
func (o *OrdererCharacters) Map() map[guid.GUID]Character {
	return o.characters
}

func (o *OrdererCharacters) Len() int {
	return len(o.characters)
}

func (o *OrdererCharacters) Add(char Character) {
	o.insertCharacter(char)
}

func (o *OrdererCharacters) insertCharacter(char Character) {
	if _, exists := o.characters[char.ID()]; exists {
		return
	}

	if len(o.characters) == 0 {
		o.characters[char.ID()] = char
		o.ordered = append(o.ordered, char.ID())
		return
	}

	// Append to end if greater than last element
	last := o.ordered[len(o.ordered)-1]
	if last < char.ID() {
		o.characters[char.ID()] = char
		o.ordered = append(o.ordered, char.ID())
		return
	}

	// Insert into the right place
	// Find first index i where evs[i].Timestamp > ev.Timestamp
	i := sort.Search(len(o.ordered), func(i int) bool {
		return o.ordered[i] > char.ID()
	})

	// Make room
	o.ordered = append(o.ordered, 0)
	copy(o.ordered[i+1:], o.ordered[i:])
	o.ordered[i] = char.ID()
	o.characters[char.ID()] = char
}
