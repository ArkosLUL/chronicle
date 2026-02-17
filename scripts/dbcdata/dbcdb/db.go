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

func (w *WoWClient) SpellCategory() (Table[dbdefs.Ent_SpellCategory], error) {
	data, err := w.ReadFile("DBFilesClient\\SpellCategory.dbc")
	if err != nil {
		return nil, err
	}

	db := dbc.NewDB(w.Build())
	table, err := db.Open("SpellCategory", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	return WrapTable[dbdefs.Ent_SpellCategory](table), nil
}

func (w *WoWClient) SpellRange() (Table[dbdefs.Ent_SpellRange], error) {
	data, err := w.ReadFile("DBFilesClient\\SpellRange.dbc")
	if err != nil {
		return nil, err
	}

	db := dbc.NewDB(w.Build())
	table, err := db.Open("SpellRange", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	return WrapTable[dbdefs.Ent_SpellRange](table), nil
}

func (w *WoWClient) SpellRadius() (Table[dbdefs.Ent_SpellRadius], error) {
	data, err := w.ReadFile("DBFilesClient\\SpellRadius.dbc")
	if err != nil {
		return nil, err
	}

	db := dbc.NewDB(w.Build())
	table, err := db.Open("SpellRadius", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	return WrapTable[dbdefs.Ent_SpellRadius](table), nil
}

// SpellEffectNames is not there
func (w *WoWClient) SpellEffectNames() (Table[dbdefs.Ent_SpellEffectNames], error) {
	data, err := w.ReadFile("DBFilesClient\\SpellEffectNames.dbc")
	if err != nil {
		return nil, err
	}

	db := dbc.NewDB(w.Build())
	table, err := db.Open("SpellEffectNames", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	return WrapTable[dbdefs.Ent_SpellEffectNames](table), nil
}

func (w *WoWClient) SpellCooldowns() (Table[dbdefs.Ent_SpellCooldowns], error) {
	data, err := w.ReadFile("DBFilesClient\\SpellCooldowns.dbc")
	if err != nil {
		return nil, err
	}

	db := dbc.NewDB(w.Build())
	table, err := db.Open("SpellCooldowns", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	return WrapTable[dbdefs.Ent_SpellCooldowns](table), nil
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
