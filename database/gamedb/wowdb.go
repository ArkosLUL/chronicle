// TODO: Add a database backing and LRU caching system for WoW data.
// TODO: Flesh out all the params and data the structures can have
package gamedb

import (
	"context"
	"fmt"
	"os"
	"sync/atomic"

	"github.com/Emyrk/chronicle/database/gamedb/chrondbc"
	"github.com/Gophercraft/core/format/dbc"
	"github.com/Gophercraft/core/vsn"
	lru "github.com/hashicorp/golang-lru/v2"
)

type SpellFetcher interface {
	Spell(id chrondbc.SpellID) (*chrondbc.Spell, error)
}

type Options struct {
	SpellsDBCPath string
}

type WoWDB struct {
	ctx        context.Context
	spellFiles *os.File
	spells     *chrondbc.SpellsDBC
	spellLRU   *lru.Cache[chrondbc.SpellID, *chrondbc.Spell]

	// spellNames is a READONLY map
	spellNames atomic.Pointer[map[string][]int32]
}

func New(ctx context.Context, opts Options) (*WoWDB, error) {
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
	c, err := lru.New[chrondbc.SpellID, *chrondbc.Spell](50)
	if err != nil {
		return nil, fmt.Errorf("lru: %w", err)
	}

	spDBC := chrondbc.NewSpells(v)

	wdb := &WoWDB{
		ctx:        ctx,
		spellLRU:   c,
		spellFiles: sf,
		spells:     spDBC,
	}
	go func() {
		spNames, err := loadSpellName(ctx, spDBC)
		if err != nil {
			return
			//return fmt.Errorf("load spell names: %w", err)
		}

		wdb.spellNames.Store(&spNames)
	}()

	return wdb, nil
}

func (w *WoWDB) TotalSpells() int {
	return w.spells.Len()
}

func (w *WoWDB) SpellByName(name string) ([]int32, error) {
	m := w.spellNames.Load()
	if m == nil {
		return nil, fmt.Errorf("spell names not loaded yet")
	}

	ids, ok := (*m)[name]
	if !ok {
		return nil, fmt.Errorf("spell not found: %s", name)
	}
	return ids, nil
}

func loadSpellName(ctx context.Context, spDBC *chrondbc.SpellsDBC) (map[string][]int32, error) {
	spellNames := make(map[string][]int32, spDBC.Len())
	err := spDBC.Range(func(cursor *chrondbc.Spell) bool {
		spellNames[cursor.Name()] = append(spellNames[cursor.Name()], int32(cursor.ID))
		return true
	})

	//go func() {
	//	spellNameDifferences(ctx, spDBC, spellNames)
	//}()

	return spellNames, err
}

func (w *WoWDB) RangeSpells(f func(*chrondbc.Spell) bool) error {
	return w.spells.Range(func(sp *chrondbc.Spell) bool {
		if sp == nil {
			return true
		}
		return f(sp)
	})
}

func (w *WoWDB) Spell(id chrondbc.SpellID) (*chrondbc.Spell, error) {
	if sp, ok := w.spellLRU.Get(id); ok {
		return sp, nil
	}
	sp, err := w.spells.ID(int(id))
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
