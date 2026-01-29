package playerposition

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/types"
)

const (
	PrefixPlayerPosition = "PLAYER_POSITION:"
)

func IsPlayerPosition(content string) (string, bool) {
	return types.Is(PrefixPlayerPosition, content)
}

type PlayerPosition struct {
	Seen time.Time
	Guid string
	X    float64
	Y    float64
}

func ParsePlayerPosition(content string) (PlayerPosition, error) {
	trimmed, ok := IsPlayerPosition(content)
	if !ok {
		return PlayerPosition{}, fmt.Errorf("not a PLAYER_POSITION message")
	}

	parts := strings.Split(trimmed, "&")

	if len(parts) < 4 {
		return PlayerPosition{}, fmt.Errorf("insufficient arguments in PLAYER_POSITION message, got %d, want at least 4", len(parts))
	}

	ts, guid, xStr, yStr := parts[0], parts[1], parts[2], parts[3]
	seen, err := time.ParseInLocation(types.AddonDateFormat, ts, time.UTC)
	if err != nil {
		return PlayerPosition{}, fmt.Errorf("invalid date format %q: %w", ts, err)
	}

	x, err := strconv.ParseFloat(xStr, 64)
	if err != nil {
		return PlayerPosition{}, fmt.Errorf("invalid x coordinate %q: %w", xStr, err)
	}

	y, err := strconv.ParseFloat(yStr, 64)
	if err != nil {
		return PlayerPosition{}, fmt.Errorf("invalid y coordinate %q: %w", yStr, err)
	}

	return PlayerPosition{
		Seen: seen,
		Guid: guid,
		X:    x,
		Y:    y,
	}, nil
}
