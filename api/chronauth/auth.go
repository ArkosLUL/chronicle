package chronauth

import (
	"context"
	"fmt"
	"log/slog"
	"net/url"
	"strings"

	"github.com/Emyrk/chronicle/database"
	"github.com/go-pkgz/auth/v2"
	"github.com/markbates/goth"
	"github.com/markbates/goth/providers/discord"
)

const (
	JWTCookieName  = "JWT"
	XSRFCookieName = "XSRF-TOKEN"
)

type Options struct {
	AccessURL *url.URL
	DevServer bool
	Database  database.Store
	Discord   DiscordOAuth
}

type Service struct {
	Providers goth.Providers
}

func New(ctx context.Context, logger *slog.Logger, opts Options) *Service {
	if opts.DevServer && !strings.Contains(opts.AccessURL.String(), "localhost") {
		panic(fmt.Sprintf("dev server can only be used with localhost access url, not %s", opts.AccessURL))
	}
	if opts.Database == nil {
		panic("database is required")
	}

	providers := make(goth.Providers)
	if opts.Discord.ClientID != "" {
		const name = "discord"
		dcallback, err := opts.AccessURL.Parse(fmt.Sprintf("/auth/%s/callback", name))
		if err != nil {
			panic(err)
		}
		d := discord.New(opts.Discord.ClientID, opts.Discord.ClientSecret, dcallback.String(), "email")
		d.SetName(name)
		providers[d.Name()] = d
	}

	return &Service{
		Providers: providers,
	}
}

func (s *Service) CallbackHandler() {

}

func dService(ctx context.Context, logger *slog.Logger, opts Options) *auth.Service {
	if opts.DevServer && !strings.Contains(opts.AccessURL.String(), "localhost") {
		panic(fmt.Sprintf("dev server can only be used with localhost access url, not %s", opts.AccessURL))
	}
	if opts.Database == nil {
		panic("database is required")
	}

	if opts.Discord.ClientID != "" {
		dcallback, err := opts.AccessURL.Parse("/auth/discord/callback")
		if err != nil {
			panic(err)
		}
		goth.UseProviders(
			discord.New(opts.Discord.ClientID, opts.Discord.ClientSecret, dcallback.String(), "email"),
		)
	}

	//persist := &Persister{appCtx: ctx, db: opts.Database, logger: logger}
	//srv := auth.NewService(auth.Opts{
	//	SecretReader: token.SecretFunc(func(id string) (string, error) { // secret key for JWT
	//		// TODO: A real secret
	//		return "secret", nil
	//	}),
	//	XSRFIgnoreMethods: []string{"GET"},
	//	JWTCookieName:     JWTCookieName,
	//	XSRFCookieName:    XSRFCookieName,
	//	Validator:         persist,
	//	ClaimsUpd:         persist,
	//	SecureCookies:     strings.Contains(opts.AccessURL, "https:"),
	//	TokenDuration:     time.Minute * 5, // token expires in 5 minutes
	//	CookieDuration:    time.Hour * 24,  // cookie expires in 1 day and will enforce re-login
	//	Issuer:            "chronicle",
	//	URL:               opts.AccessURL,
	//	AvatarStore:       avatar.NewNoOp(), // NewLocalFS("/tmp"),
	//	Logger: authlogger.Func(func(format string, args ...interface{}) {
	//		logger.Info(fmt.Sprintf(format, args...),
	//			slog.String("service", "auth"),
	//		)
	//	}),
	//})
	//
	//if opts.Discord.ClientID != "" {
	//	srv.AddProvider("discord", opts.Discord.ClientID, opts.Discord.ClientSecret)
	//}

	//if opts.DevServer {
	//	srv.AddDevProvider("localhost", 3333)
	//	logger.Info("starting dev oauth server",
	//		slog.String("url", fmt.Sprintf("localhost:3333")),
	//		slog.String("access-url", opts.AccessURL),
	//	)
	//
	//	provider, err := srv.DevAuth()
	//	if err != nil {
	//		panic(err)
	//	}
	//	pproflabel.Go(ctx, pproflabel.Service(pproflabel.ServiceOAuthDevServer), func(ctx context.Context) {
	//		provider.Run(ctx)
	//	})
	//}

	return nil
}
