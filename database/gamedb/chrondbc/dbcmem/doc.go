// Package dbcmem contains in-memory data generated from WoW DBC files.
package dbcmem

//go:generate go run ../../../../scripts/dbcdata static -o .
//go:generate go run ../../../../scripts/dbcdata derived-statics --assets-dir=../../../../assets/generated --go-dir=. --ts-dir=../../../../frontend/chronicle/src/constants/dbmem
//go:generate go run ../../../../scripts/dbcdata spell-test-data --ts-dir=../../../../frontend/chronicle/src/api/testdata
