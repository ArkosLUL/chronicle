package dbstatic

import (
	"strings"

	"github.com/google/uuid"
)

func ServerTurtleWoW() uuid.UUID {
	return uuid.MustParse("10ac9e23-ff74-43ed-83ad-96c123017097")
}
func ServerSATurtleWoW() uuid.UUID { return uuid.MustParse("eaa7e20e-ae86-4690-98e0-dde0b9f06cd0") }

func RealmAmbershire() uuid.UUID {
	return uuid.MustParse("851d2fd3-f9c5-4623-b714-924b59d916aa")
}

func RealmTelAbim() uuid.UUID {
	return uuid.MustParse("f94d3103-1cd8-40e9-ad91-a2366de33354")
}

func RealmNordanaar() uuid.UUID {
	return uuid.MustParse("bcf173a7-c94a-49fe-8930-27435d722fb7")
}

func RealmSouthSeas() uuid.UUID {
	return uuid.MustParse("ad486d39-31dd-4eb6-a43d-7d469df4ffcf")
}

func RealmByName(name string) (uuid.UUID, bool) {
	switch strings.ToLower(name) {
	case "ambershire":
		return RealmAmbershire(), true
	case "tel abim", "tel'abim":
		return RealmTelAbim(), true
	case "nordanaar":
		return RealmNordanaar(), true
	case "south seas":
		return RealmSouthSeas(), true
	default:
		return uuid.UUID{}, false
	}
}
