package servicewowdb

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/Emyrk/chronicle/database/gamedb"
	"github.com/Emyrk/chronicle/internal/services"

	"github.com/coder/serpent"
)

var _ services.Servicer = (*Service)(nil)

func OnWoWDB() string {
	return (&Service{}).Name()
}

func WoWDB(broker *services.Services) *Service {
	return services.MustGet[*Service](broker)
}

type Service struct {
	broker *services.Services

	spellDBCPath string

	db     *gamedb.WoWDB
	router chi.Router
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
	db, err := gamedb.New(gamedb.Options{
		SpellsDBCPath: s.spellDBCPath,
	})
	if err != nil {
		return err
	}
	s.db = db

	s.router = chi.NewRouter()
	s.setupRoutes()

	return nil
}

func (s *Service) setupRoutes() {
	s.router.Get("/spell/{id}", s.handleGetSpell)
}

func (s *Service) handleGetSpell(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid spell id", http.StatusBadRequest)
		return
	}

	spell, err := s.db.Spell(id)
	if err != nil {
		http.Error(w, "spell not found", http.StatusNotFound)
		return
	}

	// Cache for 24 hours since these are static data that won't change for the most part.
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(spell)
}

func (s *Service) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.router.ServeHTTP(w, r)
}

func (s *Service) Close(_ context.Context) error {
	if s.db != nil {
		return s.db.Close()
	}
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
