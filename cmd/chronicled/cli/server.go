package cli

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/Emyrk/chronicle/api"
	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/api/chronauth/authkeys"
	"github.com/Emyrk/chronicle/database"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/xerrors"

	"github.com/coder/serpent"
)

func ServerCmd() *serpent.Command {
	var (
		httpAddress string
		accessURL   string
		devAuth     bool
		postgresURL string
		discord     chronauth.DiscordOAuth
		secretPem   string
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
			{
				Name:        "Postgres URL",
				Description: "Postgres URL to connect to.",
				Required:    false,
				Flag:        "postgres-url",
				Default:     "postgresql://postgres:postgres@localhost:5432/chronicle?sslmode=disable",
				Value:       serpent.StringOf(&postgresURL),
			},
			{
				Name:        "Discord OAuth Client ID",
				Description: "Discord OAuth Client ID to use for authentication.",
				Required:    false,
				Flag:        "discord-client-id",
				Env:         "CHRONICLE_DISCORD_CLIENT_ID",
				Default:     "",
				Value:       serpent.StringOf(&discord.ClientID),
			},
			{
				Name:        "Discord OAuth Client Secret",
				Description: "Discord OAuth Client Secret to use for authentication.",
				Required:    false,
				Flag:        "discord-client-secret",
				Env:         "CHRONICLE_DISCORD_CLIENT_SECRET",
				Default:     "",
				Value:       serpent.StringOf(&discord.ClientSecret),
			},
			{
				Name:        "JWT Secret PEM",
				Description: "PEM encoded private key to use for signing JWTs.",
				Required:    false,
				Flag:        "jwt-secret-pem",
				Env:         "CHRONICLE_JWT_SECRET_PEM",
				Default:     "",
				Value:       serpent.StringOf(&secretPem),
			},
		},
		Handler: func(i *serpent.Invocation) error {
			ctx, cancel := context.WithCancel(i.Context())
			defer cancel()
			logger := getLogger(i)
			reg := prometheus.NewRegistry()

			db, err := Database(ctx, logger, postgresURL)
			if err != nil {
				return err
			}
			defer db.Close()

			serverLn, err := ProvisionListener(logger, httpAddress)
			if err != nil {
				return err
			}

			if accessURL == "" {
				addr := serverLn.Addr().(*net.TCPAddr)
				if addr.IP.IsUnspecified() {
					accessURL = fmt.Sprintf("http://localhost:%d", addr.Port)
				} else {
					accessURL = fmt.Sprintf("http://%s", serverLn.Addr().String())
				}
				logger.Info("access url not specified, using server address", slog.String("url", accessURL))
			}

			au, err := url.Parse(accessURL)
			if err != nil {
				return fmt.Errorf("invalid access url: %w", err)
			}

			if secretPem == "" {
				sec, err := authkeys.GenerateKey()
				if err != nil {
					return fmt.Errorf("generate jwt secret: %w", err)
				}
				secretPem = string(authkeys.MarshalPrivateKey(sec))
				logger.Warn("using ephemeral JWT secret; this is not recommended for production environments")
			}

			handler, err := api.New(ctx, api.Options{
				DB:        db,
				Logger:    logger,
				Registry:  reg,
				AccessURL: au,
				DevOAuth:  devAuth,
				Discord:   discord,
				SecretPEM: []byte(secretPem),
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

func Database(ctx context.Context, logger *slog.Logger, dbURL string) (database.Store, error) {
	dbURL, err := escapePostgresURLUserInfo(dbURL)
	if err != nil {
		return nil, err
	}
	pool, err := database.NewPostgresDB(ctx, logger, dbURL)
	if err != nil {
		return nil, fmt.Errorf("connect to postgres db: %w", err)
	}

	return database.New(pool), nil
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
		Handler:     handler,
		BaseContext: func(_ net.Listener) context.Context { return ctx },
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

var reInvalidPortAfterHost = regexp.MustCompile(`invalid port ".+" after host`)

// If the user provides a postgres URL with a password that contains special
// characters, the URL will be invalid. We need to escape the password so that
// the URL parse doesn't fail at the DB connector level.
func escapePostgresURLUserInfo(v string) (string, error) {
	_, err := url.Parse(v)
	// I wish I could use errors.Is here, but this error is not declared as a
	// variable in net/url. :(
	if err != nil {
		// Warning: The parser may also fail with an "invalid port" error if the password contains special
		// characters. It does not detect invalid user information but instead incorrectly reports an invalid port.
		//
		// See: https://github.com/coder/coder/issues/16319
		if strings.Contains(err.Error(), "net/url: invalid userinfo") || reInvalidPortAfterHost.MatchString(err.Error()) {
			// If the URL is invalid, we assume it is because the password contains
			// special characters that need to be escaped.

			// get everything before first @
			parts := strings.SplitN(v, "@", 2)
			if len(parts) != 2 {
				return "", xerrors.Errorf("invalid postgres url with userinfo: %s", v)
			}
			start := parts[0]
			// get password, which is the last item in start when split by :
			startParts := strings.Split(start, ":")
			password := startParts[len(startParts)-1]
			// escape password, and replace the last item in the startParts slice
			// with the escaped password.
			//
			// url.PathEscape is used here because url.QueryEscape
			// will not escape spaces correctly.
			newPassword := url.PathEscape(password)
			startParts[len(startParts)-1] = newPassword
			start = strings.Join(startParts, ":")
			return start + "@" + parts[1], nil
		}

		return "", xerrors.Errorf("parse postgres url: %w", err)
	}

	return v, nil
}
