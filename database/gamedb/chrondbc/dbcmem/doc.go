// Package dbcmem contains in-memory data generated from WoW DBC files.
//
// Types, variables, and getter functions are defined in types.go.
// The actual data is provided by server-specific sub-packages
// (e.g. dbcmem/turtle, dbcmem/epoch) which populate variables via init().
//
// To regenerate data for a specific server:
//
//	go generate -run "static|derived-statics|spell-test-data" ./database/gamedb/chrondbc/dbcmem/
package dbcmem

//go:generate go run ../../../../scripts/dbcdata static --server=turtle -o turtle
//go:generate go run ../../../../scripts/dbcdata derived-statics --server=turtle --assets-dir=../../../../assets/generated --go-dir=turtle --ts-dir=../../../../frontend/chronicle/src/constants/dbmem
//go:generate go run ../../../../scripts/dbcdata spell-test-data --ts-dir=../../../../frontend/chronicle/src/api/testdata
