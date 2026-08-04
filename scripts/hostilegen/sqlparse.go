package main

import (
	"bytes"
	"strconv"
	"strings"
)

// CreatureTemplate holds relevant fields from creature_template.
type CreatureTemplate struct {
	Entry            uint32
	DifficultyEntry1 uint32
	DifficultyEntry2 uint32
	DifficultyEntry3 uint32
	Name             string
	Faction          uint32
	NpcFlag          uint32
	Rank             uint32
	UnitFlags        uint32
	Type             uint32
	ScriptName       string
}

// DifficultyEntries returns non-zero difficulty entries.
func (ct *CreatureTemplate) DifficultyEntries() []uint32 {
	var out []uint32
	for _, e := range [3]uint32{ct.DifficultyEntry1, ct.DifficultyEntry2, ct.DifficultyEntry3} {
		if e != 0 {
			out = append(out, e)
		}
	}
	return out
}

// creature_template column indices (0-based, 85 columns total).
const (
	ctEntry     = 0
	ctDiff1     = 1
	ctDiff2     = 2
	ctDiff3     = 3
	ctName      = 10
	ctFaction   = 17
	ctNpcFlag   = 18
	ctRank      = 22
	ctUnitFlags = 31
	ctType      = 42
	ctScript    = 83
	ctMinCols   = 84 // minimum columns expected
)

// parseCreatureTemplates parses creature_template.sql into a map keyed by entry.
func parseCreatureTemplates(data []byte) map[uint32]*CreatureTemplate {
	rows := parseAllRows(data)
	result := make(map[uint32]*CreatureTemplate, len(rows))
	for _, row := range rows {
		if len(row) <= ctScript {
			continue
		}
		entry := toUint32(row[ctEntry])
		if entry == 0 {
			continue
		}
		result[entry] = &CreatureTemplate{
			Entry:            entry,
			DifficultyEntry1: toUint32(row[ctDiff1]),
			DifficultyEntry2: toUint32(row[ctDiff2]),
			DifficultyEntry3: toUint32(row[ctDiff3]),
			Name:             row[ctName],
			Faction:          toUint32(row[ctFaction]),
			NpcFlag:          toUint32(row[ctNpcFlag]),
			Rank:             toUint32(row[ctRank]),
			UnitFlags:        toUint32(row[ctUnitFlags]),
			Type:             toUint32(row[ctType]),
			ScriptName:       row[ctScript],
		}
	}
	return result
}

// parseCreatureSpawns parses creature.sql into mapID → set of creature entry IDs.
// Uses a streaming parser that only extracts columns 1 (id) and 2 (map) for efficiency
// since creature.sql is ~35MB with 2M+ rows.
func parseCreatureSpawns(data []byte) map[uint32]map[uint32]bool {
	result := make(map[uint32]map[uint32]bool)
	idx := 0
	for {
		pos := findValues(data, idx)
		if pos < 0 {
			break
		}
		idx = pos + 6 // skip past "VALUES"

		for idx < len(data) {
			idx = skipWS(data, idx)
			if idx >= len(data) || data[idx] != '(' {
				break
			}
			idx++ // skip '('

			// Column 0: guid (skip)
			_, idx = parseValue(data, idx)
			idx = skipComma(data, idx)

			// Column 1: creature template entry
			var entryStr string
			entryStr, idx = parseValue(data, idx)
			idx = skipComma(data, idx)

			// Column 2: map ID
			var mapStr string
			mapStr, idx = parseValue(data, idx)

			// Skip remaining columns to closing )
			idx = skipToCloseParen(data, idx)

			entry := toUint32(entryStr)
			mapID := toUint32(mapStr)
			if entry != 0 {
				if result[mapID] == nil {
					result[mapID] = make(map[uint32]bool)
				}
				result[mapID][entry] = true
			}

			// Skip delimiter between tuples
			idx = skipWS(data, idx)
			if idx < len(data) && data[idx] == ',' {
				idx++
			} else if idx < len(data) && data[idx] == ';' {
				idx++
				break
			}
		}
	}
	return result
}

// parseInstanceEncounters parses instance_encounters.sql into a set of
// creature entry IDs that are boss encounters (creditType=0 only).
//
// creditType=1 rows credit a spell rather than a creature, so there's no entry
// to pick up. Those bosses have to go in ExtraBosses by hand. Algalon is one.
func parseInstanceEncounters(data []byte) map[uint32]bool {
	rows := parseAllRows(data)
	result := make(map[uint32]bool, len(rows))
	for _, row := range rows {
		if len(row) < 3 {
			continue
		}
		creditType := toUint32(row[1])
		if creditType != 0 {
			continue // only creature-type credits
		}
		creditEntry := toUint32(row[2])
		if creditEntry != 0 {
			result[creditEntry] = true
		}
	}
	return result
}

// ---------------------------------------------------------------------------
// Generic SQL INSERT parser
// ---------------------------------------------------------------------------

// parseAllRows extracts all value tuples from INSERT INTO ... VALUES statements.
func parseAllRows(data []byte) [][]string {
	var result [][]string
	idx := 0
	for {
		pos := findValues(data, idx)
		if pos < 0 {
			break
		}
		idx = pos + 6

		for idx < len(data) {
			idx = skipWS(data, idx)
			if idx >= len(data) || data[idx] != '(' {
				break
			}
			row, newIdx := parseTuple(data, idx)
			if len(row) > 0 {
				result = append(result, row)
			}
			idx = newIdx
			idx = skipWS(data, idx)
			if idx < len(data) && data[idx] == ',' {
				idx++
			} else if idx < len(data) && data[idx] == ';' {
				idx++
				break
			}
		}
	}
	return result
}

// parseTuple parses a single (...) tuple and returns the values.
func parseTuple(data []byte, pos int) ([]string, int) {
	pos++ // skip '('
	var values []string
	for pos < len(data) {
		pos = skipWS(data, pos)
		if pos >= len(data) || data[pos] == ')' {
			pos++
			return values, pos
		}
		var val string
		val, pos = parseValue(data, pos)
		values = append(values, val)
		pos = skipWS(data, pos)
		if pos < len(data) && data[pos] == ',' {
			pos++
		}
	}
	return values, pos
}

// parseValue parses a single SQL value: 'string', number, or NULL.
func parseValue(data []byte, pos int) (string, int) {
	if pos >= len(data) {
		return "", pos
	}
	if data[pos] == '\'' {
		// Quoted string
		pos++
		var buf []byte
		for pos < len(data) {
			if data[pos] == '\\' && pos+1 < len(data) {
				buf = append(buf, data[pos+1])
				pos += 2
			} else if data[pos] == '\'' {
				pos++
				return string(buf), pos
			} else {
				buf = append(buf, data[pos])
				pos++
			}
		}
		return string(buf), pos
	}
	// NULL or number
	start := pos
	for pos < len(data) && data[pos] != ',' && data[pos] != ')' {
		pos++
	}
	s := strings.TrimSpace(string(data[start:pos]))
	if s == "NULL" {
		return "", pos
	}
	return s, pos
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func findValues(data []byte, start int) int {
	sub := data[start:]
	if p := bytes.Index(sub, []byte("VALUES")); p >= 0 {
		return start + p
	}
	if p := bytes.Index(sub, []byte("values")); p >= 0 {
		return start + p
	}
	return -1
}

func skipWS(data []byte, pos int) int {
	for pos < len(data) {
		b := data[pos]
		if b == ' ' || b == '\t' || b == '\n' || b == '\r' {
			pos++
		} else {
			break
		}
	}
	return pos
}

func skipComma(data []byte, pos int) int {
	pos = skipWS(data, pos)
	if pos < len(data) && data[pos] == ',' {
		pos++
	}
	return pos
}

// skipToCloseParen advances past the closing ')' while respecting quoted strings.
func skipToCloseParen(data []byte, pos int) int {
	for pos < len(data) {
		switch data[pos] {
		case '\'':
			pos++
			for pos < len(data) {
				if data[pos] == '\\' && pos+1 < len(data) {
					pos += 2
				} else if data[pos] == '\'' {
					pos++
					break
				} else {
					pos++
				}
			}
		case ')':
			return pos + 1
		default:
			pos++
		}
	}
	return pos
}

func toUint32(s string) uint32 {
	v, _ := strconv.ParseUint(strings.TrimSpace(s), 10, 32)
	return uint32(v)
}
