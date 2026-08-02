package cli

import (
	"fmt"
	"os"

	"github.com/coder/serpent"
)

// DefaultClientPath returns the default WoW client directory for a server.
// Returns empty string if unknown (caller should require --dbc).
//
// The paths below are upstream's own machine. WOW_CLIENT_PATH overrides them so
// a local checkout doesn't have to edit this file.
func DefaultClientPath(server string) string {
	if p := os.Getenv("WOW_CLIENT_PATH"); p != "" {
		return p
	}
	switch server {
	case "faebright":
		return "/home/steven/Games/Faebright"
	case "triumvirate":
		return "/home/steven/Games/TriumvirateWoW"
	case "turtle":
		return "/home/steven/Games/turtlewow/drive_c/Program Files (x86)/TurtleWoW"
	case "epoch":
		return "/home/steven/Games/ascension-wow/drive_c/Program Files/Ascension Launcher/resources/epoch-live"
	case "kronos":
		return "/home/steven/Games/kronos-wow/drive_c/Program Files (x86)/Kronos"
	case "azerothcore":
		return `A:\WOW\world of warcraft 3.3.5a hd`
	case "ascension":
		return "/home/steven/Games/ascension-wow/drive_c/Program Files/Ascension Launcher/resources/ascension-live"
	case "vanillaplus":
		return "/home/steven/Games/World of Warcraft Vanilla+"
	case "octowow":
		return "/home/steven/Games/OctoWoW"
	case "lunatic":
		return "/home/steven/Games/LunaticPTR"
	default:
		return ""
	}
}

// ServerOption returns a serpent.Option for the --server flag.
func ServerOption(dst *string) serpent.Option {
	return serpent.Option{
		Name:        "server",
		Description: "Server name (turtle, epoch). Determines default --dbc path.",
		Flag:        "server",
		Value:       serpent.StringOf(dst),
		Default:     "turtle",
	}
}

// DBCOption returns a serpent.Option for the --dbc flag.
// The default is left empty; resolved at runtime from --server via ResolveDBCPath.
func DBCOption(dst *string) serpent.Option {
	return serpent.Option{
		Name:        "dbc",
		Description: "Path to WoW client directory. Defaults based on --server.",
		Flag:        "dbc",
		Value:       serpent.StringOf(dst),
	}
}

// ResolveDBCPath returns dbcPath if explicitly set, otherwise DefaultClientPath(server).
// Returns an error if neither is available.
func ResolveDBCPath(dbcPath, server string) (string, error) {
	if dbcPath != "" {
		return dbcPath, nil
	}
	if p := DefaultClientPath(server); p != "" {
		return p, nil
	}
	return "", fmt.Errorf("no default client path for server %q; pass --dbc explicitly", server)
}
