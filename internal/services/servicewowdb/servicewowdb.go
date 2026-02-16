package servicewowdb

import (
	"context"

	"github.com/Emyrk/chronicle/internal/services"

	"github.com/coder/serpent"
)

type Service struct {
	broker *services.Services
}

func New(broker *services.Services) *Service {
	return &Service{broker: broker}
}

func (s *Service) Name() string {
	return services.ServiceWoWDB
}

func (s *Service) Configures() []string { return []string{} }
func (s *Service) DependsOn() []string  { return []string{} }

func (s *Service) Start(_ context.Context) error {

	return nil
}

func (s *Service) Close(_ context.Context) error {
	return nil
}

func (s *Service) Options() serpent.OptionSet {
	return serpent.OptionSet{}
}
