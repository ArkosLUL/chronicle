package serviceretention

import (
  "context"
  "time"

  "github.com/Emyrk/chronicle/chronicle/retention"
  "github.com/Emyrk/chronicle/database"
  "github.com/Emyrk/chronicle/database/storage"
  "github.com/Emyrk/chronicle/internal/services"
  "github.com/Emyrk/chronicle/internal/services/servicedbstore"
  "github.com/Emyrk/chronicle/internal/services/servicelogger"
  "github.com/Emyrk/chronicle/internal/services/servicestorage"

  "github.com/coder/serpent"
)

var _ services.Servicer = (*Service)(nil)

// RetentionService returns the retention service from the broker.
func RetentionService(broker *services.Services) *Service {
	return services.MustGet[*Service](broker)
}

// OnRetention returns the service name for dependency declarations.
func OnRetention() string {
	return (&Service{}).Name()
}

// Service manages log retention via periodic background jobs.
// It creates the retention Worker (used by serviceriver to register with the queue)
// and exposes configuration for the periodic schedule.
type Service struct {
	broker *services.Services

	Schedule    time.Duration
	Worker      *retention.Worker
	RealmWorker *retention.RealmWorker
}

func New(broker *services.Services) *Service {
	return &Service{
		broker: broker,
	}
}

func (s *Service) Name() string {
	return services.ServiceRetention
}

func (s *Service) DependsOn() []string {
	return []string{
		servicelogger.OnLogger(),
		servicedbstore.OnDatabaseStore(),
		servicestorage.OnStorage(),
	}
}

func (s *Service) Configures() []string {
	return []string{}
}

func (s *Service) Start(_ context.Context) error {
	logger := servicelogger.Logger(s.broker)
	store := servicedbstore.DatabaseStore(s.broker)
	stor := servicestorage.Storage(s.broker)

	namedLogger := services.NamedLogger(logger, s.Name())

	s.Worker = &retention.Worker{
		Store:  store,
		Logger: namedLogger,
	}

	s.RealmWorker = &retention.RealmWorker{
		Store:   store,
		Storage: stor,
		Logger:  namedLogger,
	}

	return nil
}

func (s *Service) Close(_ context.Context) error {
	return nil
}

func (s *Service) Options() serpent.OptionSet {
	return serpent.OptionSet{
		{
			Name:        "Retention Schedule",
			Description: "How often to run the retention job. Set to 0 to disable periodic runs.",
			Required:    false,
			Flag:        "retention-schedule",
			Env:         "CHRONICLE_RETENTION_SCHEDULE",
			Default:     "24h",
			Value:       serpent.DurationOf(&s.Schedule),
		},
	}
}

// Store returns the database store from the service broker.
func Store(broker *services.Services) database.Store {
	return servicedbstore.DatabaseStore(broker)
}

// ObjectStorage returns the object storage from the service broker.
func ObjectStorage(broker *services.Services) storage.ObjectStorage {
	return servicestorage.Storage(broker)
}
