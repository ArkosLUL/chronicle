package main

import (
	"context"
	_ "embed"
	"log"
	"strings"

	"github.com/Emyrk/chronicle/database/spice/debug"
	"github.com/Emyrk/chronicle/database/spice/policy"
	"github.com/Emyrk/chronicle/database/spice/policy/playground/relationships"
	"github.com/authzed/spicedb/pkg/tuple"

	"google.golang.org/protobuf/encoding/protojson"

	"golang.org/x/xerrors"

	"google.golang.org/grpc/metadata"

	"google.golang.org/grpc"

	"github.com/authzed/authzed-go/pkg/responsemeta"

	"github.com/authzed/authzed-go/pkg/requestmeta"

	v1 "github.com/authzed/authzed-go/proto/authzed/api/v1"
	"github.com/authzed/spicedb/pkg/cmd/datastore"
	"github.com/authzed/spicedb/pkg/cmd/server"
	"github.com/authzed/spicedb/pkg/cmd/util"
)

var _ = v1.NewSchemaServiceClient

func RunExample(ctx context.Context) error {
	srv, err := newServer(ctx)
	if err != nil {
		return err
	}

	conn, err := srv.GRPCDialContext(ctx)
	if err != nil {
		return err
	}

	schemaSrv := v1.NewSchemaServiceClient(conn)
	permSrv := v1.NewPermissionsServiceClient(conn)
	go func() {
		if err := srv.Run(ctx); err != nil {
			log.Print("error while shutting down server: %w", err)
		}
	}()

	_, err = schemaSrv.WriteSchema(ctx, &v1.WriteSchemaRequest{
		Schema: policy.Schema,
	})
	if err != nil {
		return err
	}

	token, err := populateRelationships(ctx, permSrv)
	if err != nil {
		return err
	}

	// Example: "workspace:dogfood#view@user:root"
	permsToCheck := relationships.Playground.True

	for _, r := range permsToCheck {
		perm, err := tuple.V1StringRelationship(&r)
		if err != nil {
			return xerrors.Errorf("unable to convert relationship to string: %w", err)
		}

		// Add debug information to the request so we can see the trace of the check.
		var trailerMD metadata.MD
		ctx = requestmeta.AddRequestHeaders(ctx, requestmeta.RequestDebugInformation)
		checkResp, err := permSrv.CheckPermission(ctx, &v1.CheckPermissionRequest{
			Permission:  r.Relation,
			Consistency: &v1.Consistency{Requirement: &v1.Consistency_AtLeastAsFresh{AtLeastAsFresh: token}},
			Resource:    r.Resource,
			Subject:     r.Subject,
		}, grpc.Trailer(&trailerMD))
		if err != nil {
			log.Fatalf("unable to issue PermissionCheck %q: %s", perm, err.Error())
		} else {
			log.Printf("check result (%s): %s", perm, checkResp.Permissionship.String())
			// All this debug stuff just shows the trace of the check
			// with information like cache hits.
			found, err := responsemeta.GetResponseTrailerMetadata(trailerMD, responsemeta.DebugInformation)
			if err != nil {
				return xerrors.Errorf("unable to get response metadata: %w", err)
			}

			debugInfo := &v1.DebugInformation{}
			err = protojson.Unmarshal([]byte(found), debugInfo)
			if err != nil {
				return err
			}

			if debugInfo.Check == nil {
				log.Println("No trace found for the check")
			} else {
				tp := debug.NewTreePrinter()
				debug.DisplayCheckTrace(debugInfo.Check, tp, false)
				tp.Print()
			}
		}
	}

	return nil
}

func populateRelationships(ctx context.Context, permSrv v1.PermissionsServiceClient) (*v1.ZedToken, error) {
	// Write in a workspace
	relationships.GenerateRelationships()
	// Example: group:hr#member@user:camilla
	all := relationships.RelationshipsToStrings(relationships.Playground.Relationships)

	var token *v1.ZedToken
	for _, rel := range all {
		if strings.HasPrefix(strings.TrimSpace(rel), "//") || rel == "" {
			continue
		}
		tup, err := tuple.Parse(rel)
		if err != nil {
			return nil, err
		}
		v1Rel := tuple.ToV1Relationship(tup)

		resp, err := permSrv.WriteRelationships(ctx, &v1.WriteRelationshipsRequest{Updates: []*v1.RelationshipUpdate{
			{
				Operation:    v1.RelationshipUpdate_OPERATION_TOUCH,
				Relationship: v1Rel,
			},
		}})
		if err != nil {
			return nil, err
		}
		token = resp.GetWrittenAt()
	}

	return token, nil
}

func newServer(ctx context.Context) (server.RunnableServer, error) {
	ds, err := datastore.NewDatastore(ctx,
		datastore.DefaultDatastoreConfig().ToOption(),
		datastore.WithEngine(datastore.MemoryEngine),
		//datastore.WithEngine(datastore.PostgresEngine),
		datastore.WithRequestHedgingEnabled(false),
		// must run migrations first
		// To get cli: go install github.com/authzed/spicedb/cmd/spicedb@latest
		// spicedb migrate --skip-release-check --datastore-engine=postgres --datastore-conn-uri "postgres://postgres:postgres@localhost:5432/spicedb?sslmode=disable" head
		datastore.WithURI(`postgres://postgres:postgres@localhost:5432/spicedb?sslmode=disable`),
	)
	if err != nil {
		log.Fatalf("unable to start postgres datastore: %s", err)
	}

	configOpts := []server.ConfigOption{
		server.WithGRPCServer(util.GRPCServerConfig{
			Network: util.BufferedNetwork,
			Enabled: true,
		}),
		server.WithGRPCAuthFunc(func(ctx context.Context) (context.Context, error) {
			return ctx, nil
		}),
		server.WithHTTPGateway(util.HTTPServerConfig{
			HTTPAddress: "localhost:50001",
			HTTPEnabled: false}),
		//server.WithDashboardAPI(util.HTTPServerConfig{HTTPEnabled: false}),
		server.WithMetricsAPI(util.HTTPServerConfig{
			HTTPAddress: "localhost:50000",
			HTTPEnabled: true}),
		server.WithDispatchCacheConfig(server.CacheConfig{
			Name:        "DispatchCache",
			MaxCost:     "70%",
			NumCounters: 100_000,
			Metrics:     true,
			Enabled:     true,
		}),
		server.WithNamespaceCacheConfig(server.CacheConfig{
			Name:        "NamespaceCache",
			MaxCost:     "32MiB",
			NumCounters: 1_000,
			Metrics:     true,
			Enabled:     true,
		}),
		server.WithClusterDispatchCacheConfig(server.CacheConfig{
			Name:        "ClusterCache",
			MaxCost:     "70%",
			NumCounters: 100_000,
			Metrics:     true,
			Enabled:     true,
		}),
		server.WithDatastore(ds),
		server.WithDispatchClientMetricsPrefix("coder_client"),
		server.WithDispatchClientMetricsEnabled(true),
		server.WithDispatchClusterMetricsPrefix("cluster"),
		server.WithDispatchClusterMetricsEnabled(true),
	}

	return server.NewConfigWithOptionsAndDefaults(configOpts...).Complete(ctx)
}
