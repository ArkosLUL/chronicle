package dbcdb

import (
	"bytes"

	"github.com/Gophercraft/core/format/content"
	"github.com/Gophercraft/core/format/dbc"
	"github.com/Gophercraft/core/format/dbc/dbdefs"
)

type WoWClient struct {
	content.Volume
}

// New opens a WoW client directory for reading DBC files.
// path should be the root of the WoW installation (containing Data folder).
func New(path string) (*WoWClient, error) {
	vol, err := content.Open(path)
	if err != nil {
		return nil, err
	}
	return &WoWClient{Volume: vol}, nil
}

func (w *WoWClient) Spells() (Table[dbdefs.Ent_Spell], error) {
	data, err := w.ReadFile("DBFilesClient\\Spell.dbc")
	if err != nil {
		return nil, err
	}

	db := dbc.NewDB(w.Build())
	table, err := db.Open("Spell", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	return WrapTable[dbdefs.Ent_Spell](table), nil
}

func (w *WoWClient) SpellDuration() (Table[dbdefs.Ent_SpellDuration], error) {
	data, err := w.ReadFile("DBFilesClient\\SpellDuration.dbc")
	if err != nil {
		return nil, err
	}

	db := dbc.NewDB(w.Build())
	table, err := db.Open("SpellDuration", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	return WrapTable[dbdefs.Ent_SpellDuration](table), nil
}

func (w *WoWClient) SpellAuraNames() (Table[dbdefs.Ent_SpellAuraNames], error) {
	data, err := w.ReadFile("DBFilesClient\\SpellAuraNames.dbc")
	if err != nil {
		return nil, err
	}

	db := dbc.NewDB(w.Build())
	table, err := db.Open("SpellAuraNames", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	return WrapTable[dbdefs.Ent_SpellAuraNames](table), nil
}

func (w *WoWClient) SpellCastTimes() (Table[dbdefs.Ent_SpellCastTimes], error) {
	data, err := w.ReadFile("DBFilesClient\\SpellCastTimes.dbc")
	if err != nil {
		return nil, err
	}

	db := dbc.NewDB(w.Build())
	table, err := db.Open("SpellCastTimes", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	return WrapTable[dbdefs.Ent_SpellCastTimes](table), nil
}

func (w *WoWClient) SpellIcons() (Table[dbdefs.Ent_SpellIcon], error) {
	data, err := w.ReadFile("DBFilesClient\\SpellIcon.dbc")
	if err != nil {
		return nil, err
	}

	db := dbc.NewDB(w.Build())
	table, err := db.Open("SpellIcon", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	return WrapTable[dbdefs.Ent_SpellIcon](table), nil
}
