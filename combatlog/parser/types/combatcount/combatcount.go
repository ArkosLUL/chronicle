package combatcount

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/Emyrk/chronicle/combatlog/parser/types"
)

const (
	PrefixCombatCount = `PLAYERS_IN_COMBAT:`
)

func IsCombatCount(content string) (string, bool) {
	return types.Is(PrefixCombatCount, content)
}

// Count is the number of players in and out of combat
type Count struct {
	In  int
	Out int
}

func ParseCombatCount(content string) (Count, error) {
	var empty Count

	trimmed, ok := IsCombatCount(content)
	if !ok {
		return empty, fmt.Errorf("not a PLAYERS_IN_COMBAT message")
	}

	parts := strings.Split(strings.TrimSpace(trimmed), "/")
	if len(parts) != 2 {
		return empty, fmt.Errorf("not a PLAYERS_IN_COMBAT message, expect 2 parts, got %d", len(parts))
	}

	in, err := strconv.Atoi(parts[0])
	if err != nil {
		return empty, fmt.Errorf("combat count (in): %w", err)
	}

	out, err := strconv.Atoi(parts[0])
	if err != nil {
		return empty, fmt.Errorf("combat count (out): %w", err)
	}

	return Count{
		In:  in,
		Out: out,
	}, nil
}
