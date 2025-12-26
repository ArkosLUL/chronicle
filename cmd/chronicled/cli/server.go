package cli

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"

	"github.com/Emyrk/chronicle/api"
	"github.com/coder/serpent"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/xerrors"
)

func ServerCmd() *serpent.Command {
	var (
		httpAddress string
		accessURL   string
		devAuth     bool
	)
	cmd := &serpent.Command{
		Use: "server",
		Options: []serpent.Option{
			{
				Name:        "http-address",
				Description: "Address to serve the api on.",
				Required:    false,
				Flag:        "http-address",
				Default:     "0.0.0.0:3000",
				Value:       serpent.StringOf(&httpAddress),
			},
			{
				Name:        "access-url",
				Description: "Access url to access the server from outside the cluster.",
				Required:    false,
				Flag:        "access-url",
				Default:     "",
				Value:       serpent.StringOf(&accessURL),
			},
			{
				Name:        "dev-auth",
				Description: "Enable dev oauth auth.",
				Required:    false,
				Flag:        "dev-auth",
				Default:     "false",
				Value:       serpent.BoolOf(&devAuth),
			},
		},
		Handler: func(i *serpent.Invocation) error {
			ctx, cancel := context.WithCancel(i.Context())
			defer cancel()
			logger := getLogger(i)
			reg := prometheus.NewRegistry()

			serverLn, err := ProvisionListener(logger, httpAddress)
			if err != nil {
				return err
			}

			if accessURL == "" {
				addr := serverLn.Addr().(*net.TCPAddr)
				if addr.IP.IsUnspecified() {
					accessURL = fmt.Sprintf("localhost:%d", addr.Port)
				} else {
					accessURL = serverLn.Addr().String()
				}
				logger.Info("access url not specified, using server address", slog.String("url", accessURL))
			}

			handler, err := api.New(ctx, api.Options{
				Logger:    logger,
				Registry:  reg,
				AccessURL: accessURL,
				DevOAuth:  devAuth,
			})
			if err != nil {
				return err
			}

			closeServer := ServeHandler(ctx, logger, handler.Routes(), serverLn, "api")
			defer closeServer()

			<-ctx.Done()
			return nil
		},
	}
	return cmd
}

func ProvisionListener(logger *slog.Logger, addr string) (net.Listener, error) {
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		logger.Error("http server listen", slog.String("addr", addr), slog.String("error", err.Error()))
		return nil, err
	}
	return ln, nil
}

func ServeHandler(ctx context.Context, logger *slog.Logger, handler http.Handler, ln net.Listener, name string) func() {
	// ReadHeaderTimeout is purposefully not enabled. It caused some issues with
	// websockets over the dev tunnel.
	// See: https://github.com/coder/coder/pull/3730
	//nolint:gosec
	srv := &http.Server{
		Handler: handler,
	}

	go func() {
		defer ln.Close()
		logger.Info("http server listening", slog.String("addr", ln.Addr().String()), slog.String("name", name))
		if err := srv.Serve(ln); err != nil && !xerrors.Is(err, http.ErrServerClosed) {
			logger.Error("http server serve", slog.String("addr", ln.Addr().String()), slog.String("name", name), slog.String("error", err.Error()))
		}
	}()

	return func() {
		_ = srv.Close()
	}
}
