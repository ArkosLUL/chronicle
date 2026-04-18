package fakeoidc

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"strings"
	"time"

	"github.com/markbates/goth"
	"github.com/markbates/goth/providers/openidConnect"
	"github.com/oauth2-proxy/mockoidc"
)

func Run(ctx context.Context, accessURL *url.URL) (goth.Provider, error) {
	mockoidc.NowFunc = func() time.Time {
		return time.Now().UTC()
	}

	oidc, err := mockoidc.NewServer(nil)
	if err != nil {
		return nil, err
	}
	ln, err := net.Listen("tcp", ":0")
	if err != nil {
		return nil, err
	}
	err = oidc.Start(ln, nil)
	if err != nil {
		return nil, fmt.Errorf("mock oidc: %w", err)
	}

	if strings.Contains(accessURL.Host, "192.168.1") {
		_, port, err := net.SplitHostPort(oidc.Server.Addr)
		if err != nil {
			return nil, fmt.Errorf("split host port: %w", err)
		}
		oidc.Server.Addr = accessURL.Hostname() + ":" + port
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
