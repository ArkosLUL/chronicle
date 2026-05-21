package cli

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/Gophercraft/core/format/mpq"
)

// mpqFallback provides direct hash-based MPQ file lookups, bypassing the Pool
// which only finds files indexed in MPQ listfiles. Archives are opened once and
// kept open for the lifetime of the fallback.
type mpqFallback struct {
	archives []*mpq.MPQ
}

func newMPQFallback(clientPath string) (*mpqFallback, error) {
	dataDir := filepath.Join(clientPath, "Data")

	var paths []string
	// Walk Data/ and locale subdirs (e.g. Data/enUS/) for MPQ files.
	err := filepath.WalkDir(dataDir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable dirs
		}
		if !d.IsDir() && strings.EqualFold(filepath.Ext(d.Name()), ".mpq") {
			paths = append(paths, path)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("walk Data dir: %w", err)
	}
	if len(paths) == 0 {
		return nil, fmt.Errorf("no MPQ files in %s", dataDir)
	}

	fb := &mpqFallback{}
	for _, p := range paths {
		m, err := mpq.Open(p)
		if err != nil {
			continue
		}
		fb.archives = append(fb.archives, m)
	}
	if len(fb.archives) == 0 {
		return nil, fmt.Errorf("could not open any MPQ files in %s", dataDir)
	}
	return fb, nil
}

func (f *mpqFallback) Close() {
	for _, m := range f.archives {
		_ = m.Close()
	}
}

func (f *mpqFallback) ReadFile(name string) ([]byte, error) {
	for _, m := range f.archives {
		file, err := m.OpenFile(name)
		if err != nil {
			continue
		}

		data, err := file.ReadBlock()
		_ = file.Close()
		if err != nil {
			continue
		}
		return data, nil
	}
	return nil, fmt.Errorf("file not found in any MPQ: %s", name)
}
