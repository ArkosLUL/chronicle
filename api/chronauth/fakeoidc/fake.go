package fakeoidc

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/markbates/goth"
	"github.com/markbates/goth/providers/openidConnect"
	"github.com/oauth2-proxy/mockoidc"
)

func Run(ctx context.Context, accessURL *url.URL) (goth.Provider, error) {
	mockoidc.NowFunc = func() time.Time {
		return time.Now().UTC()
	}
	oidc, err := mockoidc.Run()
	if err != nil {
		return nil, fmt.Errorf("mock oidc: %w", err)
	}

	oidc.AccessTTL = time.Hour

	go func() {
		for {
			if ctx.Err() != nil {
				return
			}
			oidc.UserQueue.Lock()
			ql := len(oidc.UserQueue.Queue)
			oidc.UserQueue.Unlock()

			if ql <= 5 {
				for i := 0; i < 5; i++ {
					oidc.UserQueue.Push(&MockUser{
						MockUser: mockoidc.DefaultUser(),
					})
				}
			}

			time.Sleep(time.Millisecond * 100)
		}
	}()

	callback, err := accessURL.Parse("/auth/dev-oidc/callback")
	if err != nil {
		return nil, fmt.Errorf("parse dev-oidc callback URL: %s", err)
	}

	op, err := openidConnect.NewNamed("dev", oidc.ClientID, oidc.ClientSecret, callback.String(), oidc.DiscoveryEndpoint(), "openid", "profile", "email")
	if err != nil {
		return nil, fmt.Errorf("new openid connect: %w", err)
	}
	return op, nil
}
