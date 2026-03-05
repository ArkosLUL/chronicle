package api

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/authz"
	"github.com/authzed/gochugaru/rel"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

const base62Alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

func randomBase62(length int) (string, error) {
	if length <= 0 {
		return "", nil
	}
	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	out := make([]byte, length)
	for i := range buf {
		out[i] = base62Alphabet[int(buf[i])%len(base62Alphabet)]
	}
	return string(out), nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func (api *API) getShareCodeLength(ctx context.Context, actor rel.Object) int {
	ok, err := api.Zed.CheckOne(ctx, nil, rel.Relationship{
		ResourceType:     "chronicle",
		ResourceID:       "chronicle",
		ResourceRelation: "shorter_urls",
		SubjectType:      actor.Typ,
		SubjectID:        actor.ID,
	})
	if err != nil || !ok {
		return 8
	}
	return 6
}

func sharedViewHash(instanceID uuid.UUID, payload json.RawMessage) string {
	sum := sha256.Sum256(append(append([]byte(instanceID.String()), 0), payload...))
	return hex.EncodeToString(sum[:])
}

func (api *API) CreateShare(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	uc := chronauth.MustAuthenticatedClaims(ctx)
	actor, _ := authz.ActorFromContext(ctx)

	var req chroniclesdk.CreateShareRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	if req.InstanceID == uuid.Nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "instance_id is required"})
		return
	}
	if len(req.Payload) == 0 || !json.Valid(req.Payload) {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "payload must be valid JSON"})
		return
	}
	if len(req.Payload) > 10*1024 {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "payload exceeds 10KB"})
		return
	}

	hash := sharedViewHash(req.InstanceID, req.Payload)
	existing, err := api.Zed.GetSharedViewByInstanceAndHash(ctx, database.GetSharedViewByInstanceAndHashParams{
		InstanceID: req.InstanceID,
		Hash:       hash,
	})
	if err == nil {
		httpapi.Write(ctx, w, http.StatusOK, chroniclesdk.CreateShareResponse{
			Code: existing.Code,
			URL:  ShareURL(r, existing.Code),
		})
		return
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		httpapi.InternalServerError(w, err)
		return
	}

	codeLength := api.getShareCodeLength(ctx, actor.Object())
	var row database.SharedView
	for i := 0; i < 10; i++ {
		code, genErr := randomBase62(codeLength)
		if genErr != nil {
			httpapi.InternalServerError(w, genErr)
			return
		}

		row, err = api.Zed.CreateSharedView(ctx, database.CreateSharedViewParams{
			Code:       code,
			Hash:       hash,
			InstanceID: req.InstanceID,
			Payload:    req.Payload,
			CreatedBy:  uuid.NullUUID{UUID: uc.Subject, Valid: true},
		})
		if err == nil {
			break
		}
		if isUniqueViolation(err) {
			if reused, lookupErr := api.Zed.GetSharedViewByInstanceAndHash(ctx, database.GetSharedViewByInstanceAndHashParams{InstanceID: req.InstanceID, Hash: hash}); lookupErr == nil {
				httpapi.Write(ctx, w, http.StatusOK, chroniclesdk.CreateShareResponse{
					Code: reused.Code,
					URL:  ShareURL(r, reused.Code),
				})
				return
			}
			continue
		}
		httpapi.InternalServerError(w, err)
		return
	}
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, chroniclesdk.CreateShareResponse{
		Code: row.Code,
		URL:  ShareURL(r, row.Code),
	})
}

func (api *API) GetShare(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	code := strings.TrimSpace(chi.URLParam(r, "code"))
	if code == "" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "code is required"})
		return
	}

	row, err := api.Zed.GetSharedViewByCode(ctx, code)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "share not found"})
			return
		}
		httpapi.InternalServerError(w, err)
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, chroniclesdk.SharedViewResponse{
		InstanceID: row.InstanceID,
		Payload:    row.Payload,
	})
}

func (api *API) shortLinkRedirectMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := r.Host
		if i := strings.IndexByte(host, ':'); i >= 0 {
			host = host[:i]
		}

		if host == "chrn.link" && r.Method == http.MethodGet {
			path := strings.TrimPrefix(r.URL.Path, "/")
			if path != "" && !strings.Contains(path, "/") {
				http.Redirect(w, r, "https://chronicleclassic.com/s/"+path, http.StatusFound)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func ShareURL(r *http.Request, code string) string {
	host := r.Host
	if strings.HasPrefix(host, "localhost") {
		return "http://" + host + "/s/" + code
	}
	return "https://chrn.link/" + code
}
