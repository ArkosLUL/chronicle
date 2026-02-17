package dbc

import (
	"github.com/Emyrk/chronicle/database/gamedb/dbcdb"
	"github.com/Gophercraft/core/format/dbc"
	"github.com/Gophercraft/core/format/dbc/dbdefs"
)

// type Table[T any] interface {
//	Underlying() *dbc.Table
//	Len() int
//	Range(f func(cursor *T) bool) error
//	Index(i int) (*T, error)
//}

var _ dbcdb.Table[Spell] = (*Spells)(nil)

type Spells struct {
	under dbcdb.Table[dbdefs.Ent_Spell]
}

func (s Spells) Underlying() *dbc.Table { return s.under.Underlying() }
func (s Spells) Len() int               { return s.under.Len() }

func (s Spells) Range(f func(cursor *Spell) bool) error {
	return s.under.Range(func(cursor *dbdefs.Ent_Spell) bool {
		sp := SpellFromDB(cursor)
		return f(sp)
	})
}

func (s Spells) Index(i int) (*Spell, error) {
	dbSp, err := s.under.Index(i)
	if err != nil {
		return nil, err
	}
	sp := SpellFromDB(dbSp)
	return sp, nil
}

func SpellFromDB(s *dbdefs.Ent_Spell) *Spell {
	return &Spell{}
}
