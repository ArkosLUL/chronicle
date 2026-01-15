//go:build static

package frontend

import (
	"embed"
	"io/fs"
	"log"
)

//go:embed chronicle/dist/*
var staticFiles embed.FS

func FS() fs.FS {
	static, err := fs.Sub(fs.FS(staticFiles), "chronicle/dist")
	if err != nil {
		log.Fatalf("failed to get static files: %s", err.Error())
	}
	return static
}
