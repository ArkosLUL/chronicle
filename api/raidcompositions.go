package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/db2sdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/authz"
	"github.com/Emyrk/chronicle/internal/services/servicetenant"
)

const (
	maxUserRaidCompositions = 50
	maxRaidCompNameLen      = 100
	maxRaidCompGroups       = 8
	raidCompGroupSize       = 5
	maxRaidCompBench        = 100
	maxRaidCompEditors      = 25
	maxRaidCompFieldLen     = 200
)

func validateRaidCompName(name string) (string, bool) {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > maxRaidCompNameLen {
		return "", false
	}
	return name, true
}

func validateRaidCompEntry(entry *chroniclesdk.RaidCompEntry) error {
	if entry == nil {
		return nil
	}
	if entry.Kind != chroniclesdk.RaidCompEntryPlayer && entry.Kind != chroniclesdk.RaidCompEntryPlaceholder {
		return fmt.Errorf("entry kind must be %q or %q", chroniclesdk.RaidCompEntryPlayer, chroniclesdk.RaidCompEntryPlaceholder)
	}
	if entry.Class == "" {
		return errors.New("entry class is required")
	}
	for field, value := range map[string]string{
		"character_id": entry.CharacterID,
		"name":         entry.Name,
		"class":        entry.Class,
		"spec":         entry.Spec,
		"note":         entry.Note,
	} {
		if len(value) > maxRaidCompFieldLen {
			return fmt.Errorf("entry %s is too long", field)
		}
	}
	return nil
}

func validateRaidCompData(data *chroniclesdk.RaidCompData) error {
	if data.Groups < 1 || data.Groups > maxRaidCompGroups {
		return fmt.Errorf("composition must have between 1 and %d groups", maxRaidCompGroups)
	}
	seen := make(map[[2]int]struct{}, len(data.Placements))
	for i := range data.Placements {
		placement := &data.Placements[i]
		if placement.Group < 0 || placement.Group >= data.Groups {
			return fmt.Errorf("placement group %d is out of range", placement.Group)
		}
		if placement.Slot < 0 || placement.Slot >= raidCompGroupSize {
			return fmt.Errorf("placement slot %d is out of range", placement.Slot)
		}
		pos := [2]int{placement.Group, placement.Slot}
		if _, dup := seen[pos]; dup {
			return fmt.Errorf("group %d slot %d is placed twice", placement.Group, placement.Slot)
		}
		seen[pos] = struct{}{}
		if err := validateRaidCompEntry(&placement.Entry); err != nil {
			return err
		}
	}
	if len(data.Bench) > maxRaidCompBench {
		return fmt.Errorf("bench can hold at most %d entries", maxRaidCompBench)
	}
	for i := range data.Bench {
		if err := validateRaidCompEntry(&data.Bench[i]); err != nil {
			return err
		}
	}
	if len(data.GroupNotes) > data.Groups {
		return errors.New("more group notes than groups")
	}
	for _, note := range data.GroupNotes {
		if len(note) > maxRaidCompFieldLen {
			return errors.New("group note is too long")
		}
	}
	return nil
}

// raidCompActor returns the acting user id, or uuid.Nil for anonymous
// requests on optional-auth routes. The SpiceDB public_viewer wildcard
// matches any user subject, so uuid.Nil still passes public view checks.
func raidCompActor(r *http.Request) uuid.UUID {
	state := chronauth.AuthenticationState(r)
	if state == nil || state.Claims == nil {
		return uuid.Nil
	}
	return state.Claims.Subject
}

func (api *API) writeRaidComposition(w http.ResponseWriter, r *http.Request, status int, row database.RaidComposition) {
	comp, err := db2sdk.RaidComposition(row)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	httpapi.Write(r.Context(), w, status, comp)
}

// ListMyRaidCompositions lists the authenticated user's saved compositions.
func (api *API) ListMyRaidCompositions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	state := chronauth.AuthenticationState(r)

	rows, err := api.Opts.Zed.ListRaidCompositionsByUser(ctx, database.ListRaidCompositionsByUserParams{
		UserID:   state.Claims.Subject,
		TenantID: servicetenant.TenantIDFromContext(ctx),
	})
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	comps, err := db2sdk.RaidCompositions(rows)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, chroniclesdk.ListRaidCompositionsResponse{
		Compositions: comps,
		Limit:        maxUserRaidCompositions,
	})
}

// CreateMyRaidComposition saves a new composition for the authenticated user.
// New compositions are publicly viewable by default (share links).
func (api *API) CreateMyRaidComposition(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	state := chronauth.AuthenticationState(r)
	userID := state.Claims.Subject

	var req chroniclesdk.CreateRaidCompositionRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	name, ok := validateRaidCompName(req.Name)
	if !ok {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: fmt.Sprintf("Name is required and must be at most %d characters", maxRaidCompNameLen),
		})
		return
	}
	if err := validateRaidCompData(&req.Data); err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: err.Error()})
		return
	}

	tenantID := servicetenant.TenantIDFromContext(ctx)
	count, err := api.Opts.Zed.CountRaidCompositionsByUser(ctx, database.CountRaidCompositionsByUserParams{
		UserID:   userID,
		TenantID: tenantID,
	})
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	if count >= maxUserRaidCompositions {
		httpapi.Write(ctx, w, http.StatusForbidden, chroniclesdk.Response{
			Message: fmt.Sprintf("You can save at most %d compositions. Delete one to save another.", maxUserRaidCompositions),
		})
		return
	}

	payload, err := json.Marshal(req.Data)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	guildID := uuid.NullUUID{}
	if req.GuildID != nil {
		guildID = uuid.NullUUID{UUID: *req.GuildID, Valid: true}
	}

	row, err := api.Opts.Zed.CreateRaidComposition(ctx, database.CreateRaidCompositionParams{
		UserID:     userID,
		TenantID:   tenantID,
		GuildID:    guildID,
		Name:       name,
		Data:       payload,
		PublicView: true,
	})
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	api.writeRaidComposition(w, r, http.StatusCreated, row)
}

// GetRaidComposition returns a composition by id. Auth is optional: public
// compositions (the default) are viewable by anyone with the link.
func (api *API) GetRaidComposition(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	compID, err := uuid.Parse(chi.URLParam(r, "compID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "Invalid composition ID"})
		return
	}

	allowed, err := api.Zed.CheckRaidComposition(ctx, compID, raidCompActor(r), authz.RaidCompView)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	if !allowed {
		// 404 instead of 403: don't leak that a private composition exists.
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "Composition not found"})
		return
	}

	row, err := api.Opts.Zed.GetRaidCompositionByID(ctx, compID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "Composition not found"})
			return
		}
		httpapi.InternalServerError(w, err)
		return
	}

	api.writeRaidComposition(w, r, http.StatusOK, row)
}

// UpdateRaidComposition updates a composition. SpiceDB gates access, so both
// the owner and granted editors can update.
func (api *API) UpdateRaidComposition(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	state := chronauth.AuthenticationState(r)

	compID, err := uuid.Parse(chi.URLParam(r, "compID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "Invalid composition ID"})
		return
	}

	var req chroniclesdk.UpdateRaidCompositionRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	allowed, err := api.Zed.CheckRaidComposition(ctx, compID, state.Claims.Subject, authz.RaidCompEdit)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	if !allowed {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "Composition not found"})
		return
	}

	params := database.UpdateRaidCompositionByIDParams{ID: compID}
	if req.Name != nil {
		name, ok := validateRaidCompName(*req.Name)
		if !ok {
			httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
				Message: fmt.Sprintf("Name is required and must be at most %d characters", maxRaidCompNameLen),
			})
			return
		}
		params.Name = pgtype.Text{String: name, Valid: true}
	}
	if req.GuildID != nil {
		params.GuildID = uuid.NullUUID{UUID: *req.GuildID, Valid: true}
	}
	if req.Data != nil {
		if err := validateRaidCompData(req.Data); err != nil {
			httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: err.Error()})
			return
		}
		payload, err := json.Marshal(req.Data)
		if err != nil {
			httpapi.InternalServerError(w, err)
			return
		}
		params.Data = payload
	}

	row, err := api.Opts.Zed.UpdateRaidCompositionByID(ctx, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "Composition not found"})
			return
		}
		httpapi.InternalServerError(w, err)
		return
	}

	api.writeRaidComposition(w, r, http.StatusOK, row)
}

// DeleteRaidComposition deletes a composition (owner or site admin only).
func (api *API) DeleteRaidComposition(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	state := chronauth.AuthenticationState(r)

	compID, err := uuid.Parse(chi.URLParam(r, "compID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "Invalid composition ID"})
		return
	}

	allowed, err := api.Zed.CheckRaidComposition(ctx, compID, state.Claims.Subject, authz.RaidCompDelete)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	if !allowed {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "Composition not found"})
		return
	}

	deleted, err := api.Opts.Zed.DeleteRaidCompositionByID(ctx, compID)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	if deleted == 0 {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "Composition not found"})
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, chroniclesdk.Response{Message: "Composition deleted"})
}

// UpdateRaidCompositionSharing declaratively sets a composition's sharing:
// public view on/off and the full editor list (owner or site admin only).
func (api *API) UpdateRaidCompositionSharing(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	state := chronauth.AuthenticationState(r)

	compID, err := uuid.Parse(chi.URLParam(r, "compID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "Invalid composition ID"})
		return
	}

	var req chroniclesdk.UpdateRaidCompositionSharingRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}
	if len(req.EditorUserIDs) > maxRaidCompEditors {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: fmt.Sprintf("At most %d editors can be granted", maxRaidCompEditors),
		})
		return
	}

	allowed, err := api.Zed.CheckRaidComposition(ctx, compID, state.Claims.Subject, authz.RaidCompManageSharing)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	if !allowed {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "Composition not found"})
		return
	}

	if err := api.Zed.SetRaidCompositionSharing(ctx, compID, req.PublicView, req.EditorUserIDs); err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	row, err := api.Opts.Zed.UpdateRaidCompositionSharing(ctx, database.UpdateRaidCompositionSharingParams{
		ID:         compID,
		PublicView: req.PublicView,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "Composition not found"})
			return
		}
		httpapi.InternalServerError(w, err)
		return
	}

	api.writeRaidComposition(w, r, http.StatusOK, row)
}
