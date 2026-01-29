package unitname

// ByEntry is a static list of some unit names by their entry ID. Helps when
// identifying units in the combat log if their name is not given from the addon.
func ByEntry(entry uint32) string {
	switch entry {
	case 89:
		return "Infernal"
	default:
		return ""
	}
}
