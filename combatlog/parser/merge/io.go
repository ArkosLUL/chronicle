package merge

import (
	"bufio"
	"io"
	"strings"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/lines"
)

func FromIOReader(lines *lines.Liner, m io.Reader) Scan {
	scanner := bufio.NewScanner(m)
	return func() (time.Time, string, error) {
		for {
			if !scanner.Scan() {
				return time.Time{}, "", io.EOF
			}

			text := scanner.Text()
			if strings.TrimSpace(text) == "" {
				// Skip empty lines
				continue
			}

			if strings.HasPrefix(text, "--") {
				// Skip comment lines
				continue
			}
			return lines.Line(scanner.Text())
		}
	}
}
