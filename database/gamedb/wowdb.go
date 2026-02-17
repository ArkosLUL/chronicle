// TODO: Add a database backing and LRU caching system for WoW data.
// TODO: Flesh out all the params and data the structures can have
package gamedb

import (
	"os"

	"github.com/Emyrk/chronicle/database/gamedb/chrondbc"
	"github.com/Gophercraft/core/format/dbc"
	"github.com/Gophercraft/core/vsn"
)

type Options struct {
	SpellsDBCPath string
}

type WoWDB struct {
	spellFiles *os.File
	spells     *chrondbc.SpellsDBC
}

func New(opts Options) (*WoWDB, error) {
	db := dbc.NewDB(vsn.V1_12_1)
	sf, err := os.Open(opts.SpellsDBCPath)
	if err != nil {
		return nil, err
	}

	v, err := db.Open("Spell", sf)
	if err != nil {
		return nil, err
	}

	return &WoWDB{
		spellFiles: sf,
		spells:     chrondbc.NewSpells(v),
	}, nil
}

func (w *WoWDB) Spell(id int) (*chrondbc.Spell, error) {
	return w.spells.ID(id)
}

func (w *WoWDB) Close() error {
	_ = w.spellFiles.Close()
	return nil
}
