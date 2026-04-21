package wotlk

import "github.com/Emyrk/chronicle/combatlog/parser/guid"

// GUIDNames is a GUID→name mapping populated during parsing.
// It is not concurrent-safe; it is only accessed from the single parse goroutine.
type GUIDNames struct {
	names map[guid.GUID]string
}

func NewGUIDNames() *GUIDNames {
	return &GUIDNames{names: make(map[guid.GUID]string)}
}

// Record stores a GUID→name association. Empty names and zero GUIDs are ignored.
func (g *GUIDNames) Record(id guid.GUID, name string) {
	if id == 0 || name == "" {
		return
	}
	g.names[id] = name
}

// Get returns the name for a GUID, or ("", false) if unknown.
func (g *GUIDNames) Get(id guid.GUID) (string, bool) {
	n, ok := g.names[id]
	return n, ok
}
