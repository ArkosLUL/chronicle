package serviceimagecache

import (
	"context"
	"os"

	"github.com/Emyrk/chronicle/frontend/imagecache"
	"github.com/Emyrk/chronicle/internal/services"

	"github.com/coder/serpent"
)

var _ services.Servicer = (*Service)(nil)

// OnImageCache returns the service name for DependsOn declarations.
func OnImageCache() string {
	return (&Service{}).Name()
}

// Handler returns the imagecache HTTP handler for the /static/icon route.
func Handler(broker *services.Services) *imagecache.Handler {
	srv := services.MustGet[*Service](broker)
	return srv.handler
}

// SpellHandler returns the imagecache HTTP handler with spell aliases for /static/spellicon.
func SpellHandler(broker *services.Services) *imagecache.Handler {
	srv := services.MustGet[*Service](broker)
	return srv.spellHandler
}

type Service struct {
	broker *services.Services

	// Config (populated by Options)
	path string

	// Configured handlers
	handler      *imagecache.Handler
	spellHandler *imagecache.Handler
}

func New(broker *services.Services) *Service {
	return &Service{broker: broker}
}

func (s *Service) Name() string {
	return services.ServiceImageCache
}

func (s *Service) Configures() []string { return []string{} }
func (s *Service) DependsOn() []string  { return []string{} }

func (s *Service) Start(_ context.Context) error {
	iconFS := imagecache.FS()
	if s.path != "" {
		iconFS = os.DirFS(s.path)
	}

	s.handler = imagecache.NewHandler(iconFS)
	s.spellHandler = imagecache.NewHandler(iconFS,
		imagecache.WithAliases(imagecache.SpellIcons),
	)
	return nil
}

func (s *Service) Close(_ context.Context) error {
	return nil
}

func (s *Service) Options() serpent.OptionSet {
	return serpent.OptionSet{
		{
			Name:        "Image Cache Path",
			Description: "Path to directory containing icon files. If empty, uses embedded icons.",
			Required:    false,
			Flag:        "imagecache-path",
			Env:         "CHRONICLE_IMAGECACHE_PATH",
			Default:     "frontend/imagecache/icons",
			Value:       serpent.StringOf(&s.path),
		},
	}
}
