package realm

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/combatlog/parser/types/realmclock"
)

const (
	PrefixRealmInfo = "REALM_INFO:"
)

func IsRealmInfo(content string) (string, bool) {
	return types.Is(PrefixRealmInfo, content)
}

type Info struct {
	Seen      time.Time
	Version   string
	Build     int
	BuildDate string
	RealmName string
}

func ParseRealmInfo(ri *realmclock.Info, content string) (Info, error) {
	trimmed, ok := IsRealmInfo(content)
	if !ok {
		return Info{}, fmt.Errorf("not a REALM_INFO message")
	}

	parts := strings.Split(trimmed, "&")

	if len(parts) < 5 {
		return Info{}, fmt.Errorf("insufficient arguments in REALM_INFO message, got %d, want at least 5", len(parts))
	}

	ts, version, buildStr, buildDate, realmName := parts[0], parts[1], parts[2], parts[3], parts[4]
	seen, err := ri.ParseAddonDate(ts)
	if err != nil {
		return Info{}, fmt.Errorf("invalid date format %q: %w", ts, err)
	}

	build, err := strconv.Atoi(buildStr)
	if err != nil {
		return Info{}, fmt.Errorf("invalid build number %q: %w", buildStr, err)
	}

	return Info{
		Seen:      seen,
		Version:   version,
		Build:     build,
		BuildDate: buildDate,
		RealmName: realmName,
	}, nil
}
