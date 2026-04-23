package characterset

import (
	"fmt"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/go-playground/locales/om"
	orderedmap "github.com/wk8/go-ordered-map/v2"
)

const (
	Dormancy = time.Minute * 20
)

var _ = om.New()

type IsActive interface {
	IsActive() bool
	ID() guid.GUID
}

type Set[T IsActive] struct {
	// characters are all characters ever seen.
	characters *orderedmap.OrderedMap[guid.GUID, T]
	// awake is any non-dormant character.
	awake *orderedmap.OrderedMap[guid.GUID, time.Time]
}

func New[T IsActive]() *Set[T] {
	return &Set[T]{
		characters: orderedmap.New[guid.GUID, T](),
		awake:      orderedmap.New[guid.GUID, time.Time](),
	}
}

func (s *Set[T]) Get(id guid.GUID) (T, bool) {
	char, exists := s.characters.Get(id)
	return char, exists
}

func (s *Set[T]) ForEach(f func(T) error) error {
	for pair := s.characters.Oldest(); pair != nil; pair = pair.Next() {
		if err := f(pair.Value); err != nil {
			return err
		}
	}
	return nil
}

// ForEachAwake iterates only non-dormant characters.
func (s *Set[T]) ForEachAwake(now time.Time, f func(T) error) error {
	var remove []guid.GUID
	for pair := s.awake.Oldest(); pair != nil; pair = pair.Next() {
		char, exists := s.Get(pair.Key)
		if !exists {
			return fmt.Errorf("character with ID %s in awake map but not in characters map", pair.Key)
		}
		if err := f(char); err != nil {
			return err
		}

		if char.IsActive() {
			// Keep awake time updated for active characters
			s.awake.Set(pair.Key, now)
		} else if now.Sub(pair.Value) > Dormancy {
			// Remove dormant characters
			remove = append(remove, pair.Key)
		}
	}

	for _, id := range remove {
		s.awake.Delete(id)
	}
	return nil
}

func (s *Set[T]) Len() int {
	return s.characters.Len()
}

func (s *Set[T]) Add(char T, now time.Time) {
	s.characters.Set(char.ID(), char)
	s.awake.Set(char.ID(), now)
}

func (s *Set[T]) Touch(id guid.GUID, now time.Time) {
	if _, exists := s.characters.Get(id); !exists {
		panic("NOO")
	}
	s.awake.Set(id, now)
}
