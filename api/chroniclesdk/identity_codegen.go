package chroniclesdk

import (
	"fmt"
	"sort"
	"strings"
	"unicode"
)

// GenerateGoCode produces copy-pasteable Go source code for instance definitions
// based on the creatures observed in the identity report. All creatures are placed
// in LoadAdds — the user must manually promote bosses to LoadBosses.
func (r *IdentityReport) GenerateGoCode() string {
	if r == nil || len(r.ZonedUnits) == 0 {
		return ""
	}

	var b strings.Builder

	zones := make([]string, 0, len(r.ZonedUnits))
	for z := range r.ZonedUnits {
		zones = append(zones, z)
	}
	sort.Strings(zones)

	for i, zone := range zones {
		units := make([]IdentityCreature, len(r.ZonedUnits[zone]))
		copy(units, r.ZonedUnits[zone])
		sort.Slice(units, func(a, b int) bool {
			return units[a].EntryID < units[b].EntryID
		})

		displayZone := zone
		if displayZone == "" {
			displayZone = "UnknownZone"
		}
		ident := zoneToGoIdent(displayZone)
		display := zoneToDisplayName(displayZone)
		zoneLower := strings.ToLower(displayZone)

		// Hostiles function
		fmt.Fprintf(&b, "func %sHostiles() map[uint32]Identity {\n", ident)
		fmt.Fprintf(&b, "\thostile := make(map[uint32]Identity)\n")
		fmt.Fprintf(&b, "\tLoadAdds(hostile, map[uint32]string{\n")
		for _, u := range units {
			fmt.Fprintf(&b, "\t\t%d: %q,\n", u.EntryID, u.Name)
		}
		fmt.Fprintf(&b, "\t})\n")
		fmt.Fprintf(&b, "\t// TODO: Move bosses from LoadAdds to LoadBosses\n")
		fmt.Fprintf(&b, "\t// LoadBosses(hostile, map[uint32]string{\n")
		fmt.Fprintf(&b, "\t// })\n")
		fmt.Fprintf(&b, "\treturn hostile\n")
		fmt.Fprintf(&b, "}\n\n")

		// Factory variable
		fmt.Fprintf(&b, "var %sFactory = &CommonFactory{\n", ident)
		fmt.Fprintf(&b, "\tName:      %q,\n", display)
		fmt.Fprintf(&b, "\tZoneNames: []string{%q},\n", zoneLower)
		fmt.Fprintf(&b, "\tHostiles:  FromMap(%sHostiles()),\n", ident)
		fmt.Fprintf(&b, "}\n")

		if i < len(zones)-1 {
			fmt.Fprintf(&b, "\n")
		}
	}

	return b.String()
}

// zoneToGoIdent converts a zone name to a Go identifier.
// "molten core" → "MoltenCore", "the deadmines" → "TheDeadmines"
func zoneToGoIdent(zone string) string {
	var b strings.Builder
	upper := true
	for _, r := range zone {
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) {
			upper = true
			continue
		}
		if upper {
			b.WriteRune(unicode.ToUpper(r))
			upper = false
		} else {
			b.WriteRune(unicode.ToLower(r))
		}
	}
	return b.String()
}

// zoneToDisplayName converts a zone name to title case for display.
// "molten core" → "Molten Core"
func zoneToDisplayName(zone string) string {
	words := strings.Fields(zone)
	for i, w := range words {
		if len(w) > 0 {
			words[i] = strings.ToUpper(w[:1]) + strings.ToLower(w[1:])
		}
	}
	return strings.Join(words, " ")
}
