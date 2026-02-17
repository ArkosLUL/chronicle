package dbcdb

import (
	"github.com/Gophercraft/core/format/dbc"
)

type Table[T any] interface {
	Underlying() *dbc.Table
	Len() int
	Range(f func(cursor *T) bool) error
	Index(i int) (*T, error)
	ID(id int) (*T, error)
	StringRef(i int) (string, error)
}

func WrapTable[T any](t *dbc.Table) Table[T] {
	return &WrappedTable[T]{wrapped: t}
}

type WrappedTable[T any] struct {
	wrapped *dbc.Table
}

func (w WrappedTable[T]) Len() int {
	return w.wrapped.Len()
}

func (w WrappedTable[T]) Underlying() *dbc.Table {
	return w.wrapped
}

func (w *WrappedTable[T]) Range(f func(cursor *T) bool) error {
	return w.wrapped.Range(func(cursor *T) bool {
		return f(cursor)
	})
}

func (w *WrappedTable[T]) ID(i int) (*T, error) {
	x := new(T)
	if err := w.wrapped.ID(i, x); err != nil {
		return nil, err
	}
	return x, nil
}

func (w *WrappedTable[T]) Index(i int) (*T, error) {
	x := new(T)
	if err := w.wrapped.Index(i, x); err != nil {
		return nil, err
	}
	return x, nil
}

func (w *WrappedTable[T]) StringRef(i int) (string, error) {
	return w.wrapped.StringRef(i)
}
