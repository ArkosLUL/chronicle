package auras

import (
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
)

type Tracking struct {
	units map[guid.GUID]map[string]int
}

func New() *Tracking {
	return &Tracking{}
}

func (t *Tracking) Process(m messages.Message) error {

	return nil
}
