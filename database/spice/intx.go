package spice

import (
	"github.com/Emyrk/chronicle/database"
	"github.com/jackc/pgx/v5"
)

type reverter interface {
	AddRevert(func())
	RevertAll()
}

type SpiceDBTX struct {
	*Spice
	Reverts []func()
}

func (s *Spice) Wrap(tx database.Store) *SpiceDBTX {
	cpy := *s
	cpy.db = tx
	spiceTx := &SpiceDBTX{
		Spice: &cpy,
	}
	spiceTx.Spice.reverts = spiceTx
	return spiceTx
}

func (s *Spice) InTx(f func(database.Store) error, opts *pgx.TxOptions) error {
	return s.db.InTx(func(nestedTX database.Store) error {
		wrapped := s.Wrap(nestedTX)
		err := f(wrapped)
		if err != nil {
			s.reverts.RevertAll()
			return err
		}
		return nil
	}, opts)
}

func (s *SpiceDBTX) AddRevert(f func()) {
	s.Reverts = append(s.Reverts, f)
}

func (s *SpiceDBTX) RevertAll() {
	all := s.Reverts
	s.Reverts = nil

	for i := range all {
		all[i]()
	}
}

func (s *SpiceDBTX) InTx(f func(database.Store) error, _ *pgx.TxOptions) error {
	// Do not double wrap transactions.
	return f(s)
}
