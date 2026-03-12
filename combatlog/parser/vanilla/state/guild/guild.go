package guild

import (
	"context"
	"fmt"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/instances/instancehook"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/authz"
	"github.com/google/uuid"
)

var _ instancehook.Hook = (*Tracker)(nil)

type Tracker struct {
	Guilds      map[string]map[guid.GUID]struct{}
	Participant map[guid.GUID]struct{}
}

func New() *Tracker {
	return &Tracker{
		Guilds:      make(map[string]map[guid.GUID]struct{}),
		Participant: make(map[guid.GUID]struct{}),
	}
}

func (g *Tracker) Insert(ctx context.Context, realmID uuid.UUID, tx *authz.AuthzTX) (*database.Guild, error) {
	guildIDs := make(map[string]uuid.UUID)
	mostGuildPlayers := 0
	var guildWithMostPlayers *database.Guild
	for name, players := range g.Guilds {
		insertedGuild, err := tx.UpsertGuild(ctx, database.UpsertGuildParams{
			RealmID:   realmID,
			Name:      name,
			CreatedAt: database.Timestamptz(time.Now()),
		})
		if err != nil {
			return nil, fmt.Errorf("upsert guild: %w", err)
		}
		guildIDs[name] = insertedGuild.ID
		if len(players) > mostGuildPlayers {
			mostGuildPlayers = len(players)
			guildWithMostPlayers = &insertedGuild
		}
	}

	if mostGuildPlayers > len(g.Participant)/2 && guildWithMostPlayers != nil {
		return guildWithMostPlayers, nil
	}
	return nil, nil
}

func (g *Tracker) Finalize(ctx context.Context) error {
	return nil
}

func (g *Tracker) ProcessMessage(active bool, encounterID uuid.UUID, msg messages.Message) error {
	if !active {
		return nil
	}

	switch ty := msg.(type) {
	case *messages.Damage:
		if ty.Caster != nil && (*ty.Caster).IsPlayer() {
			g.Participant[*ty.Caster] = struct{}{}
		}
	case *messages.Heal:
		if ty.Caster.IsPlayer() {
			g.Participant[ty.Caster] = struct{}{}
		}
	case *messages.Combatant:
		if ty.Guild == nil {
			return nil
		}
		if ty.Guid.IsZero() || !ty.Guid.IsPlayer() {
			return nil
		}
		if ty.Guild.Name == "" {
			return nil
		}
		if _, ok := g.Participant[ty.Guid]; !ok {
			return nil
		}
		if _, ok := g.Guilds[ty.Guild.Name]; !ok {
			g.Guilds[ty.Guild.Name] = make(map[guid.GUID]struct{})
		}
		g.Guilds[ty.Guild.Name][ty.Guid] = struct{}{}
	}

	return nil
}
