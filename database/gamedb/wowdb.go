// TODO: Add a database backing and LRU caching system for WoW data.
// TODO: Flesh out all the params and data the structures can have
package gamedb

import "github.com/Emyrk/chronicle/database"

type WoWDB struct {
	//Spells map[SpellID]*Spell
}

func New(db database.Store) (*WoWDB, error) {
	return &WoWDB{}, nil
}
