package main

import (
	"fmt"

	"github.com/Emyrk/chronicle/scripts/dbcdata/dbcdb"
)

func main() {
	wc, err := dbcdb.New()
	if err != nil {
		panic(err)
	}

	spdb, err := wc.Spells()
	if err != nil {
		panic(err)
	}

	sp, err := spdb.Index(14769)
	if err != nil {
		panic(err)
	}
	fmt.Println(sp)
}
