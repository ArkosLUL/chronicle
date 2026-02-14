package merge

import (
	"bufio"
	"io"
	"strings"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/lines"
	"github.com/Emyrk/chronicle/combatlog/parser/logfile"
)

func FromIOReader(lines *lines.Liner, m io.Reader) Scan {
	scanner := bufio.NewScanner(m)
	return func() (*logfile.Context, time.Time, string, error) {
		for {
			if !scanner.Scan() {
				return nil, time.Time{}, "", io.EOF
			}

			text := scanner.Text()
			text = strings.TrimSpace(text)
			if text == "" {
				// Skip empty lines
				continue
			}

			if strings.HasPrefix(text, "--") {
				// Skip comment lines
				continue
			}
			ts, c, err := lines.Line(scanner.Text())
			return nil, ts, c, err
		}
	}
}
