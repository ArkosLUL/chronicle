package chronauth

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/internal/pproflabel"
	"github.com/go-pkgz/auth/v2"
	"github.com/go-pkgz/auth/v2/avatar"
	authlogger "github.com/go-pkgz/auth/v2/logger"
	"github.com/go-pkgz/auth/v2/token"
)

type Options struct {
	AccessURL string
	DevServer bool
	Database  database.Store
	Discord   DiscordOAuth
}

func Service(ctx context.Context, logger *slog.Logger, opts Options) *auth.Service {
	if opts.AccessURL == "" {
		panic("access url is required")
	}
	if opts.DevServer && !strings.Contains(opts.AccessURL, "localhost") {
		panic(fmt.Sprintf("dev server can only be used with localhost access url, not %s", opts.AccessURL))
	}
	if opts.Database == nil {
		panic("database is required")
	}

	srv := auth.NewService(auth.Opts{
		SecretReader: token.SecretFunc(func(id string) (string, error) { // secret key for JWT
			// TODO: A real secret
			return "secret", nil
		}),
		SecureCookies:  strings.Contains(opts.AccessURL, "https:"),
		TokenDuration:  time.Minute * 5, // token expires in 5 minutes
		CookieDuration: time.Hour * 24,  // cookie expires in 1 day and will enforce re-login
		Issuer:         "chronicle",
		URL:            opts.AccessURL,
		AvatarStore:    avatar.NewNoOp(), // NewLocalFS("/tmp"),
		Validator: token.ValidatorFunc(func(_ string, claims token.Claims) bool {
			// allow only dev_* names
			return claims.User != nil && strings.HasPrefix(claims.User.Name, "dev_")
		}),
		Logger: authlogger.Func(func(format string, args ...interface{}) {
			logger.Info(fmt.Sprintf(format, args...),
				slog.String("service", "auth"),
			)
		}),
	})

	if opts.Discord.ClientID != "" {
		srv.AddProvider( "discord", opts.Discord.ClientID, opts.Discord.ClientSecret)
	}

	if opts.DevServer {
		srv.AddDevProvider("localhost", 3333)
		logger.Info("starting dev oauth server",
			slog.String("url", fmt.Sprintf("localhost:3333")),
			slog.String("access-url", opts.AccessURL),
		)

		provider, err := srv.DevAuth()
		if err != nil {
			panic(err)
		}
		pproflabel.Go(ctx, pproflabel.Service(pproflabel.ServiceOAuthDevServer), func(ctx context.Context) {
			provider.Run(ctx)
		})
	}

	return srv
}
