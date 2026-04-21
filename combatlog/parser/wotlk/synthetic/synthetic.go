package synthetic

import (
	"context"
	"log/slog"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/registry"
	"github.com/Emyrk/chronicle/combatlog/parser/wotlk/synthetic/zonedetector"
	"github.com/Emyrk/chronicle/database/gamedb"
)

// NameResolver looks up a name for a GUID. Populated by the parser from
// combat log source/dest fields.
type NameResolver interface {
	Get(id guid.GUID) (string, bool)
}

// Synthetic processes the raw combat log events, and occasionally will insert
// or mutate synthetic events to help downstream consumers.
type Synthetic struct {
	logger *slog.Logger

	unitInfo     *unitInfo
	zoneDetector *zonedetector.ZoneDetector

	wowDB gamedb.GameDB
}

func New(ctx context.Context, logger *slog.Logger, wowDB gamedb.GameDB, reg *registry.Registry, names NameResolver) *Synthetic {
	return &Synthetic{
		logger:       logger,
		wowDB:        wowDB,
		unitInfo:     newUnitInfo(ctx, wowDB, names),
		zoneDetector: zonedetector.New(reg),
	}
}

func (s *Synthetic) ProcessMessages(msgs []messages.Message) ([]messages.Message, error) {
	msgs = s.unitInfo.ProcessMessages(msgs)
	msgs = s.zoneDetector.ProcessMessages(msgs)
	return msgs, nil
}
