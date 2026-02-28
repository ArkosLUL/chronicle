package cli

import (
	"os"
	"path/filepath"
	"text/template"
)

func writeTemplate(path string, tmpl *template.Template, data any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}

	f, err := os.Create(path)
	if err != nil {
		return err
	}
	//nolint:errcheck
	defer f.Close()
	return tmpl.Execute(f, data)
}
