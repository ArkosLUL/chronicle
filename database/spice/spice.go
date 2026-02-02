package spice

import (
	"context"
	"errors"
	"log/slog"
	"net/url"

	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/spice/policy"
	v1 "github.com/authzed/authzed-go/proto/authzed/api/v1"
	"github.com/authzed/authzed-go/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

var _ database.Store = (*Spice)(nil)

type Spice struct {
	client    *authzed.Client
	logger    *slog.Logger
	debugging bool

	// reverts is only used if in a transaction.
	reverts reverter

	db database.Store
}

type Options struct {
	GRPCURL *url.URL
	Logger  *slog.Logger
}

func New(ctx context.Context, opts *Options) (*Spice, error) {
	cli, err := authzed.NewClient(
		opts.GRPCURL.String(),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return nil, err
	}

	_, err = cli.WriteSchema(ctx, &v1.WriteSchemaRequest{
		Schema: policy.Schema,
	})
	if err != nil {
		return nil, err
	}

	return &Spice{
		client: cli,
		logger: opts.Logger,
	}, nil
}

func (s *Spice) Debugging(set bool) {
	s.debugging = set
}

func (s *Spice) Close() error {
	return errors.Join(s.client.Close(), s.db.Close())
}
