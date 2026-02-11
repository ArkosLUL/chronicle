package unitdied

import (
	"fmt"
	"strings"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/combatlog/parser/types/realmclock"
)

const (
	PrefixUnitDied = "UNIT_DIED:"
)

func IsUnitDead(content string) (string, bool) {
	return types.Is(PrefixUnitDied, content)
}

type Info struct {
	Name string
	ID   guid.GUID
}

func ParseUnitDead(ri *realmclock.Info, content string) (Info, error) {
	trimmed, ok := IsUnitDead(content)
	if !ok {
		return Info{}, fmt.Errorf("not a UNIT_DIED message")
	}

	parts := strings.Split(trimmed, ":")

	if len(parts) < 2 {
		return Info{}, fmt.Errorf("insufficient arguments in UNIT_DIED message, got %d, want at least 2", len(parts))
	}

	name := parts[0]
	id := parts[1]

	gid, err := guid.FromString(id)
	if err != nil {
		return Info{}, fmt.Errorf("invalid GUID format %q: %w", id, err)
	}

	return Info{
		Name: name,
		ID:   gid,
	}, nil
}
