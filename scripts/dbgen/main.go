package main

import (
	"fmt"
	"os"
	"runtime"
	"strings"

	"golang.org/x/text/cases"
	"golang.org/x/text/language"
	"golang.org/x/xerrors"
)

func main() {
	err := run()
	if err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "error: %s\n", err)
		os.Exit(1)
	}
}

func run() error {
	err := generateUniqueConstraints()
	if err != nil {
		return xerrors.Errorf("generate unique constraints: %w", err)
	}

	err = generateForeignKeyConstraints()
	if err != nil {
		return xerrors.Errorf("generate foreign key constraints: %w", err)
	}

	err = generateCheckConstraints()
	if err != nil {
		return xerrors.Errorf("generate check constraints: %w", err)
	}

	return nil
}

// localFilePath returns the location of `main.go` in the dbgen package.
func localFilePath() (string, error) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		return "", xerrors.Errorf("failed to get caller")
	}
	return filename, nil
}

// nameFromSnakeCase converts snake_case to CamelCase.
func nameFromSnakeCase(s string) string {
	var ret string
	for _, ss := range strings.Split(s, "_") {
		switch ss {
		case "id":
			ret += "ID"
		case "ids":
			ret += "IDs"
		case "jwt":
			ret += "JWT"
		case "idx":
			ret += "Index"
		case "api":
			ret += "API"
		case "uuid":
			ret += "UUID"
		case "gitsshkeys":
			ret += "GitSSHKeys"
		case "fkey":
			// ignore
		default:
			ret += cases.Title(language.AmericanEnglish).String(ss)
		}
	}
	return ret
}
