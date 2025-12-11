package encounters

import (
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
)

type Fight struct {
	Hostiles []CharacterFight
	Start    time.Time
	End      time.Time
}

type CharacterFight struct {
	ID       guid.GUID
	Activity Active
}
