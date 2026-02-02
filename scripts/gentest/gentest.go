package gentest

import (
	"flag"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/xerrors"
)

var updateGoldenFiles = flag.Bool("update", false, "Update golden files")

type TestGenerationParams struct {
	Generate        func(dir string) (string, error)
	TestDataDir     string
	GoldenExtension string
}

func FindFileWithExtension(dir string, extension string) (string, error) {
	if len(extension) == 0 {
		return "", xerrors.Errorf("empty extension")
	}
	if extension[0] != '.' {
		extension = "." + extension
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return "", xerrors.Errorf("read dir %q: %w", dir, err)
	}
	for _, entry := range entries {
		if filepath.Ext(entry.Name()) == extension {
			return entry.Name(), nil
		}
	}
	return "", xerrors.Errorf("file with extension %q not found in %q", extension, dir)
}

// TestGeneration will perform a generate command and compare it to a golden file
// with the expected output.
func TestGeneration(t *testing.T, params TestGenerationParams) {
	t.Helper()

	if !strings.HasPrefix(".", params.GoldenExtension) {
		params.GoldenExtension = "." + params.GoldenExtension
	}
	files, err := os.ReadDir(params.TestDataDir)
	require.NoErrorf(t, err, "read dir: %s", params.TestDataDir)

	for _, f := range files {
		if !f.IsDir() {
			// Only test directories
			continue
		}
		f := f
		t.Run(f.Name(), func(t *testing.T) {
			t.Parallel()

			dir := filepath.Join(".", "testdata", f.Name())
			output, err := params.Generate("./" + dir)
			if err != nil {
				t.Log(output)
			}
			require.NoErrorf(t, err, "generate %q", dir)

			goldenFile, err := FindFileWithExtension(dir, params.GoldenExtension)
			require.NoError(t, err, "find golden file")

			golden := filepath.Join(dir, goldenFile)

			if *updateGoldenFiles {
				err = os.WriteFile(golden, []byte(output), 0644)
				require.NoErrorf(t, err, "write file %s", golden)
				return
			}

			expected, err := os.ReadFile(golden)
			require.NoErrorf(t, err, "read file %s", golden)
			expectedString := strings.TrimSpace(string(expected))
			output = strings.TrimSpace(output)
			require.Equal(t, expectedString, output, "matched output")
		})
	}
}
