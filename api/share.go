package api

import (
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
	"github.com/Emyrk/chronicle/api/panellayoutapi"
	"github.com/Emyrk/chronicle/api/shortcode"
	"github.com/Emyrk/chronicle/database"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func sharedViewHash(instanceID uuid.UUID, payload json.RawMessage) string {
	sum := sha256.Sum256(append(append([]byte(instanceID.String()), 0), payload...))
	return hex.EncodeToString(sum[:])
}

func (api *API) CreateShare(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	uc := chronauth.MustAuthenticatedClaims(ctx)

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

	// Look up instance slug to persist on the shared view.
	var instanceSlug string
	inst, instErr := api.Zed.Instance(ctx, req.InstanceID)
	if instErr == nil && inst.HashedSlug.Valid && inst.HashedSlug.String != "" {
		instanceSlug = inst.HashedSlug.String
	}

	instanceNullUUID := uuid.NullUUID{UUID: req.InstanceID, Valid: true}
	hash := sharedViewHash(req.InstanceID, req.Payload)
	existing, err := api.Zed.GetSharedViewByInstanceAndHash(ctx, database.GetSharedViewByInstanceAndHashParams{
		InstanceID: instanceNullUUID,
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

	codeLength := panellayoutapi.GetShareCodeLength(ctx, api.Zed)
	var row database.SharedView
	for i := 0; i < 10; i++ {
		code, genErr := shortcode.RandomBase62(codeLength)
		if genErr != nil {
			httpapi.InternalServerError(w, genErr)
			return
		}

		row, err = api.Zed.CreateSharedView(ctx, database.CreateSharedViewParams{
			Code:         code,
			Hash:         hash,
			InstanceID:   instanceNullUUID,
			InstanceSlug: instanceSlug,
			Payload:      req.Payload,
			CreatedBy:    uuid.NullUUID{UUID: uc.Subject, Valid: true},
		})
		if err == nil {
			break
		}
		if isUniqueViolation(err) {
			if reused, lookupErr := api.Zed.GetSharedViewByInstanceAndHash(ctx, database.GetSharedViewByInstanceAndHashParams{InstanceID: instanceNullUUID, Hash: hash}); lookupErr == nil {
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

	instanceID := row.InstanceID.UUID
	slug := row.InstanceSlug

	// If instance_id was nulled (reparse cascade), resolve current instance via slug.
	if !row.InstanceID.Valid && slug != "" {
		inst, slugErr := api.Zed.InstanceBySlug(ctx, pgtype.Text{String: slug, Valid: true})
		if slugErr == nil {
			instanceID = inst.ID
		}
	}

	// If we still don't have a slug, try looking it up from the instance.
	if slug == "" && instanceID != uuid.Nil {
		inst, instErr := api.Zed.Instance(ctx, instanceID)
		if instErr == nil && inst.HashedSlug.Valid && inst.HashedSlug.String != "" {
			slug = inst.HashedSlug.String
		}
	}

	if instanceID == uuid.Nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "instance no longer exists"})
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, chroniclesdk.SharedViewResponse{
		InstanceID:   instanceID,
		InstanceSlug: slug,
		Payload:      row.Payload,
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
			if code, ok := strings.CutPrefix(path, "l/"); ok && code != "" && !strings.Contains(code, "/") {
				http.Redirect(w, r, "https://chronicleclassic.com/account/layout-lab?shared_code="+code, http.StatusFound)
				return
			}
			if path != "" && !strings.Contains(path, "/") {
				http.Redirect(w, r, "https://chronicleclassic.com/s/"+path, http.StatusFound)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func LayoutShareURL(r *http.Request, code string) string {
	host := r.Host
	if strings.HasPrefix(host, "localhost") {
		return "http://" + host + "/account/layout-lab?shared_code=" + code
	}
	return "https://chrn.link/l/" + code
}

func ShareURL(r *http.Request, code string) string {
	host := r.Host
	if strings.HasPrefix(host, "localhost") {
		return "http://" + host + "/s/" + code
	}
	return "https://chrn.link/" + code
}
