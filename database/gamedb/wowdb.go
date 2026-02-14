// TODO: Add a database backing and LRU caching system for WoW data.
// TODO: Flesh out all the params and data the structures can have
package gamedb

type WoWDB struct {
	Spells map[SpellID]*Spell
}

func New() (*WoWDB, error) {
	return &WoWDB{}, nil
}

type Icon string
type SpellID int
