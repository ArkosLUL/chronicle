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

func New() (*WoWClient, error) {
	vol, err := content.Open("/home/steven/Games/turtlewow/drive_c/Program Files (x86)/TurtleWoW")
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

  dbdefs.Ent_Spell{}

	return WrapTable[dbdefs.Ent_Spell](table), nil
}
