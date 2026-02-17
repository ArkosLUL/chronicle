package servicewowdb

import (
	"context"

	"github.com/Emyrk/chronicle/database/gamedb"
	"github.com/Emyrk/chronicle/internal/services"

	"github.com/coder/serpent"
)

var _ services.Servicer = (*Service)(nil)

func OnWoWDB() string {
	return (&Service{}).Name()
}

type Service struct {
	broker *services.Services

	spellDBCPath string
}

func New(broker *services.Services) *Service {
	return &Service{
		broker: broker,
	}
}

func (s *Service) Name() string {
	return services.ServiceWoWDB
}

func (s *Service) DependsOn() []string {
	return []string{}
}

func (s *Service) Start(ctx context.Context) error {
	v, err := gamedb.New(gamedb.Options{
		SpellsDBCPath: s.spellDBCPath,
	})
	var _ = v

	return err
}

func (s *Service) Close(_ context.Context) error {
	return nil
}

func (s *Service) Options() serpent.OptionSet {
	return serpent.OptionSet{
		{
			Name:        "spell-dbc-path",
			Description: "Path to Spell.dbc file.",
			Default:     "./assets/Spell.dbc",
			Env:         "CHRONICLE_SPELL_DBC_PATH",
			Value:       serpent.StringOf(&s.spellDBCPath),
		},
	}
}

func (s *Service) Configures() []string {
	return []string{}
}
