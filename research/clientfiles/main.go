package main

import (
	"bytes"

	"github.com/Gophercraft/core/format/content"
	"github.com/Gophercraft/core/format/dbc"
	"github.com/Gophercraft/core/format/dbc/dbdefs"
)

func main() {
	Moonfire()
}

func Moonfire() {
	vol, err := content.Open("/home/steven/Games/turtlewow/drive_c/Program Files (x86)/TurtleWoW")
	perr(err)

	data, err := vol.ReadFile("DBFilesClient\\SpellIcon.dbc")
	perr(err)

	db := dbc.NewDB(vol.Build())
	table, err := db.Open("SpellIcon", bytes.NewReader(data))
	perr(err)

	if err := table.Range(func(cursor *dbdefs.Ent_SpellIcon) bool {
		//log.Dump("cursor", cursor)
		//name := cursor.Name_lang[i18n.English]
		//if strings.Contains(strings.ToLower(name), "moonfire") {
		//	log.Dump("cursor with moonfire", cursor)
		//}
		return true
	}); err != nil {
		panic(err)
	}
}

func perr(err error) {
	if err != nil {
		panic(err)
	}
}
