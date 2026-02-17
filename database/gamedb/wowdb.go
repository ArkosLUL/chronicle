// TODO: Add a database backing and LRU caching system for WoW data.
// TODO: Flesh out all the params and data the structures can have
package gamedb

import (
	"fmt"
	"os"

	"github.com/Emyrk/chronicle/database/gamedb/chrondbc"
	"github.com/Gophercraft/core/format/dbc"
	"github.com/Gophercraft/core/vsn"
	lru "github.com/hashicorp/golang-lru/v2"
)

type Options struct {
	SpellsDBCPath string
}

type WoWDB struct {
	spellFiles *os.File
	spells     *chrondbc.SpellsDBC
	spellLRU   *lru.Cache[int, *chrondbc.Spell]
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

	// Responses are already cached by the client browser, so not sure how useful
	// this really is.
	c, err := lru.New[int, *chrondbc.Spell](50)
	if err != nil {
		return nil, fmt.Errorf("lru: %w", err)
	}
	return &WoWDB{
		spellLRU:   c,
		spellFiles: sf,
		spells:     chrondbc.NewSpells(v),
	}, nil
}

func (w *WoWDB) Spell(id int) (*chrondbc.Spell, error) {
	if sp, ok := w.spellLRU.Get(id); ok {
		return sp, nil
	}
	sp, err := w.spells.ID(id)
	if err != nil {
		return nil, err
	}

	w.spellLRU.Add(id, sp)
	return sp, nil
}

func (w *WoWDB) Close() error {
	_ = w.spellFiles.Close()
	return nil
}
