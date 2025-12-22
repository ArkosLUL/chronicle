package character

import "github.com/Emyrk/chronicle/combatlog/parser/guid"

type Onyxia struct {
	*Common
}

func NewOnyxiaCharacter(id guid.GUID, all *Characters) (Character, bool) {
	entry, ok := id.GetEntry()
	if !ok {
		return nil, false
	}

	if entry != 10184 {
		return nil, false
	}

	return &Onyxia{
		Common: NewCommonCharacter(id, all),
	}, true
}
