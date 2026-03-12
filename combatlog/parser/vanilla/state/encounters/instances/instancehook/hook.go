package instancehook

import (
	"context"

	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/google/uuid"
)

type Hook interface {
	ProcessMessage(active bool, encounterID uuid.UUID, m messages.Message) error

	// Finalize is called when the instance is finalized. Nothing more should happen after this.
	Finalize(ctx context.Context) error

	// TODO:
	//FightStarted(fight *OngoingFight, m messages.Message)
	//FightEnded(fight Fight)
	//CharacterActive(id guid.GUID, c character.Character, m messages.Message)
	//CharacterInactive(id guid.GUID, c character.Character, m messages.Message)
}
