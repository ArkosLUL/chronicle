package chronauth

import (
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"sort"
	"strings"

	"github.com/Emyrk/chronicle/api/chronauth/fakeoidc"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/database"
	"github.com/go-chi/chi/v5"
	"github.com/gorilla/sessions"
	"github.com/markbates/goth"
	"github.com/markbates/goth/gothic"
	"github.com/markbates/goth/providers/discord"
)

const (
	JWTCookieName  = "JWT"
	XSRFCookieName = "XSRF-TOKEN"

	OAuthSessionName = "chronicle_oauth_session"
	AuthSessionName  = "chronicle_auth_session"
)

type Options struct {
	AccessURL *url.URL
	DevServer bool
	Database  database.Store
	Discord   DiscordOAuth

	Sessions SessionOptions
}

type Service struct {
	Providers goth.Providers
	Store     sessions.Store
	Database  database.Store
	logger    *slog.Logger

	sessions *Sessions
}

func New(ctx context.Context, logger *slog.Logger, opts Options) (*Service, error) {
	if opts.DevServer && !strings.Contains(opts.AccessURL.String(), "localhost") {
		return nil, fmt.Errorf("dev server can only be used with localhost access url, not %s", opts.AccessURL)
	}
	if opts.Database == nil {
		return nil, fmt.Errorf("no database store provided")
	}

	providers := make(goth.Providers)
	if opts.Discord.ClientID != "" {
		const name = "discord"
		dcallback, err := opts.AccessURL.Parse(fmt.Sprintf("/auth/%s/callback", name))
		if err != nil {
			return nil, fmt.Errorf("parse discord auth callback URL: %s", err)
		}
		d := discord.New(opts.Discord.ClientID, opts.Discord.ClientSecret, dcallback.String(), "email")
		d.SetName(name)
		providers[d.Name()] = d
	}

	store := sessions.NewCookieStore([]byte("secret"))
	store.Options.HttpOnly = true
	store.Options.Secure = opts.AccessURL.Scheme == "https"
	if !store.Options.Secure {
		logger.Warn("using non-secure cookie store; this is not recommended for production environments")
	}

	sess, err := NewSessions(opts.Sessions)
	if err != nil {
		return nil, fmt.Errorf("new sessions: %w", err)
	}

	if opts.DevServer {
		devProv, err := fakeoidc.Run(ctx, opts.AccessURL)
		if err != nil {
			return nil, fmt.Errorf("mock oidc: %w", err)
		}

		providers[devProv.Name()] = devProv
	}

	return &Service{
		Providers: providers,
		Store:     store,
		Database:  opts.Database,
		logger:    logger.With(slog.String("service", "auth")),
		sessions:  sess,
	}, nil
}

func (s *Service) GetProvider(r *http.Request) (goth.Provider, error) {
	name := chi.URLParam(r, "provider")
	provider, ok := s.Providers[name]
	if !ok {
		return nil, fmt.Errorf("provider %s not found", name)
	}
	return provider, nil
}

func (s *Service) StoreInSession(key string, value string, req *http.Request, res http.ResponseWriter) error {
	session, _ := s.Store.New(req, OAuthSessionName)

	if err := updateSessionValue(session, key, value); err != nil {
		return err
	}

	return session.Save(req, res)
}

func (s *Service) GetFromSession(key string, req *http.Request) (string, error) {
	session, _ := s.Store.Get(req, OAuthSessionName)
	value, err := getSessionValue(session, key)
	if err != nil {
		return "", errors.New("could not find a matching session for this request")
	}

	return value, nil
}

func (s *Service) GetAuthURL(res http.ResponseWriter, req *http.Request) (string, error) {
	provider, err := s.GetProvider(req)
	if err != nil {
		return "", err
	}
	sess, err := provider.BeginAuth(gothic.SetState(req))
	if err != nil {
		return "", err
	}

	url, err := sess.GetAuthURL()
	if err != nil {
		return "", err
	}

	err = s.StoreInSession(provider.Name(), sess.Marshal(), req, res)

	if err != nil {
		return "", err
	}

	return url, err
}

func (s *Service) CompleteUserAuth(res http.ResponseWriter, req *http.Request) (goth.User, error) {
	provider, err := s.GetProvider(req)
	if err != nil {
		return goth.User{}, err
	}

	value, err := s.GetFromSession(provider.Name(), req)
	if err != nil {
		return goth.User{}, err
	}
	defer s.Logout(res, req)
	sess, err := provider.UnmarshalSession(value)
	if err != nil {
		return goth.User{}, err
	}

	err = validateState(req, sess)
	if err != nil {
		return goth.User{}, err
	}

	user, err := provider.FetchUser(sess)
	if err == nil {
		// user can be found with existing session data
		return user, err
	}

	params := req.URL.Query()
	if params.Encode() == "" && req.Method == "POST" {
		req.ParseForm()
		params = req.Form
	}

	// get new token and retry fetch
	_, err = sess.Authorize(provider, params)
	if err != nil {
		return goth.User{}, err
	}

	err = s.StoreInSession(provider.Name(), sess.Marshal(), req, res)

	if err != nil {
		return goth.User{}, err
	}

	gu, err := provider.FetchUser(sess)
	if err != nil {
		return goth.User{}, fmt.Errorf("fetch user: %w", err)
	}

	s.logger.Debug("new oauth login",
		slog.String("provider", provider.Name()),
		slog.String("email", gu.Email),
		slog.String("name", gu.Name),
		slog.String("id", gu.UserID),
	)
	return gu, err
}

// Logout invalidates a user session.
func (s *Service) Logout(res http.ResponseWriter, req *http.Request) error {
	for _, cookieName := range []string{AuthSessionName, OAuthSessionName} {
		session, err := s.Store.Get(req, cookieName)
		if err != nil {
			return err
		}
		session.Options.MaxAge = -1
		session.Values = make(map[interface{}]interface{})
		err = session.Save(req, res)
		if err != nil {
			return errors.New("Could not delete user session ")
		}
	}

	return nil
}

func (s *Service) BeginAuthHandler(res http.ResponseWriter, req *http.Request) {
	url, err := s.GetAuthURL(res, req)
	if err != nil {
		res.WriteHeader(http.StatusBadRequest)
		fmt.Fprintln(res, err)
		return
	}

	http.Redirect(res, req, url, http.StatusTemporaryRedirect)
}

func (s *Service) Handler() http.Handler {
	mux := chi.NewRouter()

	mux.Get("/list", func(w http.ResponseWriter, r *http.Request) {
		list := make([]string, 0, len(s.Providers))
		for _, p := range s.Providers {
			list = append(list, p.Name())
		}
		sort.Strings(list)
		httpapi.Write(r.Context(), w, http.StatusOK, list)
	})
	mux.Get("/{provider}", func(w http.ResponseWriter, r *http.Request) {
		// Login url
		sess, ok := s.Authenticated(w, r)
		if !ok {
			return
		}
		if sess != nil {
			return // Already authenticated
		}
		//if gothUser, err := s.CompleteUserAuth(w, r); err == nil {
		//	httpapi.Write(r.Context(), w, http.StatusOK, gothUser)
		//	return
		//}
		s.BeginAuthHandler(w, r)
	})

	mux.Get("/{provider}/callback", func(w http.ResponseWriter, r *http.Request) {
		sess, ok := s.Authenticated(w, r)
		if !ok {
			return
		}

		if sess != nil {
			// Already authenticated
			httpapi.Write(r.Context(), w, http.StatusOK, sess)
			return
		}

		ctx := r.Context()
		_, ok = s.provider(w, r)
		if !ok {
			return
		}

		user, err := s.CompleteUserAuth(w, r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// TODO: Upsert user, make an access token, and send that token as a cookie.
		//   Switch to chronicle handling the auth
		session, ok := s.Signup(w, r, user)
		if !ok {
			return
		}

		jwt, err := s.sessions.CreateSession(ctx, session)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		auth, err := s.Store.New(r, AuthSessionName)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		auth.Values["jwt"] = jwt
		err = auth.Save(r, w)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		httpapi.Write(r.Context(), w, http.StatusOK, session)
	})
	mux.Get("/{provider}/logout", func(w http.ResponseWriter, r *http.Request) {
		_ = s.Logout(w, r)
		//w.Header().Set("Location", "/")
		//w.WriteHeader(http.StatusTemporaryRedirect)
		httpapi.Write(r.Context(), w, http.StatusNoContent, nil)
	})

	mux.Get("/logout", func(w http.ResponseWriter, r *http.Request) {
		user, ok := s.Authenticated(w, r)
		if !ok {
			return
		}

		if user != nil {
			// TODO: Delete sessions
			_ = s.Logout(w, r)
		}

		httpapi.Write(r.Context(), w, http.StatusNoContent, nil)
		return
	})

	return mux
}

func (s *Service) provider(w http.ResponseWriter, r *http.Request) (goth.Provider, bool) {
	name := chi.URLParam(r, "provider")
	provider, ok := s.Providers[name]
	if !ok {
		httpapi.Write(r.Context(), w, http.StatusInternalServerError, fmt.Errorf("provider %s not found", name))
		return nil, false
	}
	return provider, ok
}

func updateSessionValue(session *sessions.Session, key, value string) error {
	var b bytes.Buffer
	gz := gzip.NewWriter(&b)
	if _, err := gz.Write([]byte(value)); err != nil {
		return err
	}
	if err := gz.Flush(); err != nil {
		return err
	}
	if err := gz.Close(); err != nil {
		return err
	}

	session.Values[key] = b.String()
	return nil
}

func getSessionValue(session *sessions.Session, key string) (string, error) {
	value := session.Values[key]
	if value == nil {
		return "", fmt.Errorf("could not find a matching session for this request")
	}

	rdata := strings.NewReader(value.(string))
	r, err := gzip.NewReader(rdata)
	if err != nil {
		return "", err
	}
	s, err := io.ReadAll(r)
	if err != nil {
		return "", err
	}

	return string(s), nil
}

// validateState ensures that the state token param from the original
// AuthURL matches the one included in the current (callback) request.
func validateState(req *http.Request, sess goth.Session) error {
	rawAuthURL, err := sess.GetAuthURL()
	if err != nil {
		return err
	}

	authURL, err := url.Parse(rawAuthURL)
	if err != nil {
		return err
	}

	reqState := gothic.GetState(req)

	originalState := authURL.Query().Get("state")
	if originalState != "" && (originalState != reqState) {
		return errors.New("state token mismatch")
	}
	return nil
}
