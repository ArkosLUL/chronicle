package panellayoutapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"

	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/api/httpmw"
	"github.com/Emyrk/chronicle/api/shortcode"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/authz"
	"github.com/Emyrk/chronicle/database/authz/policy"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

var panelLayoutTitleRegex = regexp.MustCompile(`^[A-Za-z0-9_\-\s]+$`)

const (
	maxPanelLayoutPayloadBytes = 10 * 1024
	maxPanelCount              = 8
	maxUserPanelLayouts        = 30
)

type Handler struct {
	zed  *authz.Authz
	auth *chronauth.Service
}

func New(zed *authz.Authz, auth *chronauth.Service) *Handler {
	return &Handler{zed: zed, auth: auth}
}

func (h *Handler) Routes() http.Handler {
	r := chi.NewRouter()

	r.Get("/shared/{layoutID}", h.GetSharedLayout)
	r.Get("/code/{code}", h.GetSharedLayoutByCode)

	r.Group(func(r chi.Router) {
		r.Use(h.auth.Authenticated(false))
		r.Get("/defaults", h.GetLayoutDefaults)
		r.Put("/defaults", h.UpdateLayoutDefaults)
		r.Get("/instance-defaults", h.GetInstanceDefaults)
		r.Get("/action-bar", h.GetActionBarSlots)
		r.Put("/action-bar", h.UpdateActionBarSlots)
		r.Route("/{userID}", func(r chi.Router) {
			r.Use(httpmw.UserIDMiddleware(h.zed))
			r.Get("/", h.ListUserPanelLayouts)
		})
		r.Post("/track", h.TrackLayout)
		r.Delete("/track/{layoutID}", h.UntrackLayout)
		r.Post("/", h.CreateUserPanelLayout)
		r.Put("/{layoutID}", h.UpdateUserPanelLayoutByID)
		r.Delete("/{layoutID}", h.DeleteUserPanelLayoutByID)
	})
	return r
}

func countPanelsInPayload(payload json.RawMessage) (int, error) {
	var partial struct {
		Items []json.RawMessage `json:"items"`
	}

	if err := json.Unmarshal(payload, &partial); err != nil {
		return 0, err
	}

	return len(partial.Items), nil
}

func validatePanelLayoutRequest(title string, payload json.RawMessage) (string, bool) {
	if title == "" {
		return "title is required", false
	}
	if !panelLayoutTitleRegex.MatchString(title) {
		return "title must match [A-Z, a-z, 0-9, _, -, space]", false
	}
	if len(payload) > maxPanelLayoutPayloadBytes {
		return "payload exceeds 10KB limit", false
	}
	if len(payload) == 0 {
		payload = json.RawMessage(`{}`)
	}
	if !json.Valid(payload) {
		return "payload must be valid JSON", false
	}

	count, err := countPanelsInPayload(payload)
	if err == nil && count > maxPanelCount {
		return fmt.Sprintf("layout cannot exceed %d panels (has %d)", maxPanelCount, count), false
	}

	return "", true
}

func toOwnerIDPtr(userID uuid.NullUUID) *uuid.UUID {
	if !userID.Valid {
		return nil
	}
	id := userID.UUID
	return &id
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func GetShareCodeLength(ctx context.Context, zed *authz.Authz) int {
	l := 8
	usr, ok := authz.ActorFromContext(ctx)
	if !ok {
		return l
	}
	ok, err := zed.CheckOne(ctx, nil, policy.New().GlobalChronicle().CanShorter_urls_User(usr))
	if err != nil || !ok {
		return l
	}
	return 6
}

func toStringPtr(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	v := value.String
	return &v
}

func toNullUUID(id uuid.UUID) uuid.NullUUID {
	return uuid.NullUUID{UUID: id, Valid: true}
}

func toNullUUIDPtr(id *uuid.UUID) uuid.NullUUID {
	if id == nil {
		return uuid.NullUUID{}
	}
	return uuid.NullUUID{UUID: *id, Valid: true}
}

func nullUUIDToPtr(id uuid.NullUUID) *uuid.UUID {
	if !id.Valid {
		return nil
	}
	value := id.UUID
	return &value
}

func layoutDefaultsToSDK(desktopID uuid.NullUUID, mobileID uuid.NullUUID) chroniclesdk.LayoutDefaultsResponse {
	return chroniclesdk.LayoutDefaultsResponse{
		DefaultDesktopLayoutID: nullUUIDToPtr(desktopID),
		DefaultMobileLayoutID:  nullUUIDToPtr(mobileID),
	}
}

func actionBarSlotsRowToSDK(row database.GetUserActionBarSlotsRow) chroniclesdk.ActionBarSlotsResponse {
	return chroniclesdk.ActionBarSlotsResponse{
		Slot1: nullUUIDToPtr(row.Slot1),
		Slot2: nullUUIDToPtr(row.Slot2),
		Slot3: nullUUIDToPtr(row.Slot3),
		Slot4: nullUUIDToPtr(row.Slot4),
		Slot5: nullUUIDToPtr(row.Slot5),
		Slot6: nullUUIDToPtr(row.Slot6),
		Slot7: nullUUIDToPtr(row.Slot7),
		Slot8: nullUUIDToPtr(row.Slot8),
		Slot9: nullUUIDToPtr(row.Slot9),
		Slot0: nullUUIDToPtr(row.Slot0),
	}
}

func actionBarSlotsUpsertRowToSDK(row database.UpsertUserActionBarSlotsRow) chroniclesdk.ActionBarSlotsResponse {
	return chroniclesdk.ActionBarSlotsResponse{
		Slot1: nullUUIDToPtr(row.Slot1),
		Slot2: nullUUIDToPtr(row.Slot2),
		Slot3: nullUUIDToPtr(row.Slot3),
		Slot4: nullUUIDToPtr(row.Slot4),
		Slot5: nullUUIDToPtr(row.Slot5),
		Slot6: nullUUIDToPtr(row.Slot6),
		Slot7: nullUUIDToPtr(row.Slot7),
		Slot8: nullUUIDToPtr(row.Slot8),
		Slot9: nullUUIDToPtr(row.Slot9),
		Slot0: nullUUIDToPtr(row.Slot0),
	}
}

func emptyActionBarSlotsSDK() chroniclesdk.ActionBarSlotsResponse {
	return chroniclesdk.ActionBarSlotsResponse{}
}

func actionBarSlotsRequestToParams(userID uuid.UUID, req chroniclesdk.UpdateActionBarSlotsRequest) database.UpsertUserActionBarSlotsParams {
	return database.UpsertUserActionBarSlotsParams{
		UserID: userID,
		Slot1:  toNullUUIDPtr(req.Slot1),
		Slot2:  toNullUUIDPtr(req.Slot2),
		Slot3:  toNullUUIDPtr(req.Slot3),
		Slot4:  toNullUUIDPtr(req.Slot4),
		Slot5:  toNullUUIDPtr(req.Slot5),
		Slot6:  toNullUUIDPtr(req.Slot6),
		Slot7:  toNullUUIDPtr(req.Slot7),
		Slot8:  toNullUUIDPtr(req.Slot8),
		Slot9:  toNullUUIDPtr(req.Slot9),
		Slot0:  toNullUUIDPtr(req.Slot0),
	}
}

func parseOptionalLayoutID(raw json.RawMessage) (present bool, value *uuid.UUID, err error) {
	if len(raw) == 0 {
		return false, nil, nil
	}

	if string(raw) == "null" {
		return true, nil, nil
	}

	var rawID string
	if err := json.Unmarshal(raw, &rawID); err != nil {
		return true, nil, fmt.Errorf("must be a UUID string or null")
	}

	parsed, err := uuid.Parse(rawID)
	if err != nil {
		return true, nil, fmt.Errorf("must be a valid UUID")
	}

	return true, &parsed, nil
}

func (h *Handler) canUseLayoutAsDefault(ctx context.Context, userID uuid.UUID, layoutID uuid.UUID) (bool, error) {
	layout, err := h.zed.GetPanelLayoutByID(ctx, layoutID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}

	if layout.UserID.Valid && layout.UserID.UUID == userID {
		return true, nil
	}

	tracked, err := h.zed.IsLayoutTrackedByUser(ctx, database.IsLayoutTrackedByUserParams{
		UserID:   userID,
		LayoutID: layoutID,
	})
	if err != nil {
		return false, err
	}

	return tracked, nil
}

func panelLayoutToSDK(row database.UserPanelLayout) chroniclesdk.UserPanelLayout {
	return chroniclesdk.UserPanelLayout{
		ID:           row.ID,
		Title:        row.Title,
		Icon:         row.Icon,
		Description:  row.Description,
		Payload:      json.RawMessage(row.Payload),
		Code:         toStringPtr(row.Code),
		Version:      row.Version,
		OwnerID:      toOwnerIDPtr(row.UserID),
		IsTracked:    false,
		TrackerCount: 0,
		CreatedAt:    row.CreatedAt.Time,
		UpdatedAt:    row.UpdatedAt.Time,
	}
}

func panelLayoutListRowToSDK(row database.ListUserPanelLayoutsRow) chroniclesdk.UserPanelLayout {
	return chroniclesdk.UserPanelLayout{
		ID:            row.ID,
		Title:         row.Title,
		Icon:          row.Icon,
		Description:   row.Description,
		Payload:       json.RawMessage(row.Payload),
		Code:          toStringPtr(row.Code),
		Version:       row.Version,
		OwnerID:       toOwnerIDPtr(row.UserID),
		OwnerUsername: toStringPtr(row.OwnerUsername),
		IsTracked:     row.IsTracked,
		TrackerCount:  row.TrackerCount,
		CreatedAt:     row.CreatedAt.Time,
		UpdatedAt:     row.UpdatedAt.Time,
	}
}

func panelLayoutWithTrackerToSDK(row database.GetPanelLayoutByIDRow) chroniclesdk.UserPanelLayout {
	return chroniclesdk.UserPanelLayout{
		ID:            row.ID,
		Title:         row.Title,
		Icon:          row.Icon,
		Description:   row.Description,
		Payload:       json.RawMessage(row.Payload),
		Code:          toStringPtr(row.Code),
		Version:       row.Version,
		OwnerID:       toOwnerIDPtr(row.UserID),
		OwnerUsername: toStringPtr(row.OwnerUsername),
		IsTracked:     false,
		TrackerCount:  row.TrackerCount,
		CreatedAt:     row.CreatedAt.Time,
		UpdatedAt:     row.UpdatedAt.Time,
	}
}

func writeDuplicateLayoutTitleError(ctx context.Context, w http.ResponseWriter) {
	err := httpapi.NewAPIError(
		errors.New("layout with that title already exists for this user"),
		"A layout with this title already exists in your Layout Book.",
		http.StatusBadRequest,
	).
		CTA("Rename the layout before saving or cloning.")

	httpapi.Write(ctx, w, err.Status, err.Response)
}

func (h *Handler) ensureUserLayoutLimitNotReached(ctx context.Context, w http.ResponseWriter, userID uuid.UUID) bool {
	count, err := h.zed.CountUserPanelLayoutsTotal(ctx, toNullUUID(userID))
	if err != nil {
		httpapi.InternalServerError(w, err)
		return false
	}
	if count >= maxUserPanelLayouts {
		httpapi.Write(ctx, w, http.StatusConflict, chroniclesdk.Response{
			Message: fmt.Sprintf("maximum of %d panel layouts reached", maxUserPanelLayouts),
		})
		return false
	}

	return true
}

func actionBarSlotIDs(slots chroniclesdk.ActionBarSlotsResponse) []uuid.UUID {
	ids := make([]uuid.UUID, 0, 10)
	for _, slot := range []*uuid.UUID{slots.Slot1, slots.Slot2, slots.Slot3, slots.Slot4, slots.Slot5, slots.Slot6, slots.Slot7, slots.Slot8, slots.Slot9, slots.Slot0} {
		if slot != nil {
			ids = append(ids, *slot)
		}
	}
	return ids
}

func (h *Handler) GetLayoutDefaults(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims := chronauth.MustAuthenticatedClaims(ctx)

	defaults, err := h.zed.GetUserPanelLayoutDefaults(ctx, claims.Subject)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, layoutDefaultsToSDK(defaults.DefaultDesktopLayoutID, defaults.DefaultMobileLayoutID))
}

func (h *Handler) GetInstanceDefaults(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims := chronauth.MustAuthenticatedClaims(ctx)

	defaults, err := h.zed.GetUserPanelLayoutDefaults(ctx, claims.Subject)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	actionBarSlots, err := h.zed.GetUserActionBarSlots(ctx, claims.Subject)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		httpapi.InternalServerError(w, err)
		return
	}

	actionBarResp := emptyActionBarSlotsSDK()
	if !errors.Is(err, sql.ErrNoRows) {
		actionBarResp = actionBarSlotsRowToSDK(actionBarSlots)
	}

	layoutIDs := map[uuid.UUID]struct{}{}
	if defaults.DefaultDesktopLayoutID.Valid {
		layoutIDs[defaults.DefaultDesktopLayoutID.UUID] = struct{}{}
	}
	if defaults.DefaultMobileLayoutID.Valid {
		layoutIDs[defaults.DefaultMobileLayoutID.UUID] = struct{}{}
	}
	for _, id := range actionBarSlotIDs(actionBarResp) {
		layoutIDs[id] = struct{}{}
	}

	layoutsByID := make(map[uuid.UUID]chroniclesdk.UserPanelLayout, len(layoutIDs))
	for layoutID := range layoutIDs {
		layout, fetchErr := h.zed.GetPanelLayoutByID(ctx, layoutID)
		if fetchErr != nil {
			if errors.Is(fetchErr, sql.ErrNoRows) {
				continue
			}
			httpapi.InternalServerError(w, fetchErr)
			return
		}

		sdkLayout := panelLayoutWithTrackerToSDK(layout)
		layoutsByID[layoutID] = sdkLayout
	}

	resp := chroniclesdk.InstanceDefaultsResponse{
		ActionBarSlots:   &actionBarResp,
		ActionBarLayouts: make([]chroniclesdk.UserPanelLayout, 0, len(actionBarSlotIDs(actionBarResp))),
	}

	if defaults.DefaultDesktopLayoutID.Valid {
		if layout, ok := layoutsByID[defaults.DefaultDesktopLayoutID.UUID]; ok {
			layoutCopy := layout
			resp.DefaultDesktopLayout = &layoutCopy
		}
	}
	if defaults.DefaultMobileLayoutID.Valid {
		if layout, ok := layoutsByID[defaults.DefaultMobileLayoutID.UUID]; ok {
			layoutCopy := layout
			resp.DefaultMobileLayout = &layoutCopy
		}
	}

	seenActionBarLayouts := map[uuid.UUID]struct{}{}
	for _, id := range actionBarSlotIDs(actionBarResp) {
		if _, seen := seenActionBarLayouts[id]; seen {
			continue
		}
		layout, ok := layoutsByID[id]
		if !ok {
			continue
		}
		resp.ActionBarLayouts = append(resp.ActionBarLayouts, layout)
		seenActionBarLayouts[id] = struct{}{}
	}

	httpapi.Write(ctx, w, http.StatusOK, resp)
}

func (h *Handler) UpdateLayoutDefaults(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims := chronauth.MustAuthenticatedClaims(ctx)

	var rawReq struct {
		DefaultDesktopLayoutID json.RawMessage `json:"default_desktop_layout_id"`
		DefaultMobileLayoutID  json.RawMessage `json:"default_mobile_layout_id"`
	}
	if !httpapi.Read(ctx, w, r, &rawReq) {
		return
	}

	desktopPresent, desktopID, err := parseOptionalLayoutID(rawReq.DefaultDesktopLayoutID)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "default_desktop_layout_id " + err.Error()})
		return
	}
	mobilePresent, mobileID, err := parseOptionalLayoutID(rawReq.DefaultMobileLayoutID)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "default_mobile_layout_id " + err.Error()})
		return
	}
	if !desktopPresent && !mobilePresent {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "at least one default layout field must be provided"})
		return
	}

	if desktopID != nil {
		allowed, err := h.canUseLayoutAsDefault(ctx, claims.Subject, *desktopID)
		if err != nil {
			httpapi.InternalServerError(w, err)
			return
		}
		if !allowed {
			httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "default_desktop_layout_id must reference a layout you own or track"})
			return
		}
	}
	if mobileID != nil {
		allowed, err := h.canUseLayoutAsDefault(ctx, claims.Subject, *mobileID)
		if err != nil {
			httpapi.InternalServerError(w, err)
			return
		}
		if !allowed {
			httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "default_mobile_layout_id must reference a layout you own or track"})
			return
		}
	}

	current, err := h.zed.GetUserPanelLayoutDefaults(ctx, claims.Subject)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	nextDesktop := current.DefaultDesktopLayoutID
	nextMobile := current.DefaultMobileLayoutID
	if desktopPresent {
		nextDesktop = toNullUUIDPtr(desktopID)
	}
	if mobilePresent {
		nextMobile = toNullUUIDPtr(mobileID)
	}

	updated, err := h.zed.UpdateUserPanelLayoutDefaults(ctx, database.UpdateUserPanelLayoutDefaultsParams{
		ID:                     claims.Subject,
		DefaultDesktopLayoutID: nextDesktop,
		DefaultMobileLayoutID:  nextMobile,
	})
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, layoutDefaultsToSDK(updated.DefaultDesktopLayoutID, updated.DefaultMobileLayoutID))
}

func (h *Handler) GetActionBarSlots(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims := chronauth.MustAuthenticatedClaims(ctx)

	slots, err := h.zed.GetUserActionBarSlots(ctx, claims.Subject)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			empty := emptyActionBarSlotsSDK()
			httpapi.Write(ctx, w, http.StatusOK, empty)
			return
		}
		httpapi.InternalServerError(w, err)
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, actionBarSlotsRowToSDK(slots))
}

func (h *Handler) UpdateActionBarSlots(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims := chronauth.MustAuthenticatedClaims(ctx)

	actor, ok := authz.ActorFromContext(ctx)
	if !ok {
		httpapi.Forbidden(w, nil)
		return
	}
	if ok, err := h.zed.CheckOne(ctx, nil, policy.New().GlobalChronicle().CanCreate_layout_User(actor)); !ok || err != nil {
		httpapi.Forbidden(w, nil)
		return
	}

	var req chroniclesdk.UpdateActionBarSlotsRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	updated, err := h.zed.UpsertUserActionBarSlots(ctx, actionBarSlotsRequestToParams(claims.Subject, req))
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, actionBarSlotsUpsertRowToSDK(updated))
}

func (h *Handler) ListUserPanelLayouts(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	targetUser := httpmw.User(ctx)

	layouts, err := h.zed.ListUserPanelLayouts(ctx, toNullUUID(targetUser.ID))
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	defaults, err := h.zed.GetUserPanelLayoutDefaults(ctx, targetUser.ID)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	actionBarSlots, err := h.zed.GetUserActionBarSlots(ctx, targetUser.ID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		httpapi.InternalServerError(w, err)
		return
	}

	var actionBarResp *chroniclesdk.ActionBarSlotsResponse
	if errors.Is(err, sql.ErrNoRows) {
		empty := emptyActionBarSlotsSDK()
		actionBarResp = &empty
	} else {
		mapped := actionBarSlotsRowToSDK(actionBarSlots)
		actionBarResp = &mapped
	}

	resp := make([]chroniclesdk.UserPanelLayout, 0, len(layouts))
	for _, layout := range layouts {
		resp = append(resp, panelLayoutListRowToSDK(layout))
	}

	httpapi.Write(ctx, w, http.StatusOK, chroniclesdk.ListUserPanelLayoutsResponse{
		Layouts:                resp,
		DefaultDesktopLayoutID: nullUUIDToPtr(defaults.DefaultDesktopLayoutID),
		DefaultMobileLayoutID:  nullUUIDToPtr(defaults.DefaultMobileLayoutID),
		ActionBarSlots:         actionBarResp,
	})
}

func (h *Handler) GetSharedLayout(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	layoutIDRaw := chi.URLParam(r, "layoutID")
	layoutID, err := uuid.Parse(layoutIDRaw)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid layout id"})
		return
	}

	layout, err := h.zed.GetPanelLayoutByID(ctx, layoutID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "layout not found"})
			return
		}
		httpapi.InternalServerError(w, err)
		return
	}

	isTracked := false
	if claims, ok := chronauth.AuthenticatedClaims(ctx); ok && claims != nil {
		tracked, err := h.zed.IsLayoutTrackedByUser(ctx, database.IsLayoutTrackedByUserParams{
			UserID:   claims.Subject,
			LayoutID: layoutID,
		})
		if err != nil {
			httpapi.InternalServerError(w, err)
			return
		}
		isTracked = tracked
	}

	resp := panelLayoutWithTrackerToSDK(layout)
	resp.IsTracked = isTracked
	httpapi.Write(ctx, w, http.StatusOK, resp)
}

func (h *Handler) GetSharedLayoutByCode(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	code := chi.URLParam(r, "code")
	if code == "" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "code is required"})
		return
	}

	layout, err := h.zed.GetPanelLayoutByCode(ctx, pgtype.Text{String: code, Valid: true})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "layout not found"})
			return
		}
		httpapi.InternalServerError(w, err)
		return
	}

	isTracked := false
	if claims, ok := chronauth.AuthenticatedClaims(ctx); ok && claims != nil {
		tracked, err := h.zed.IsLayoutTrackedByUser(ctx, database.IsLayoutTrackedByUserParams{
			UserID:   claims.Subject,
			LayoutID: layout.ID,
		})
		if err != nil {
			httpapi.InternalServerError(w, err)
			return
		}
		isTracked = tracked
	}

	resp := chroniclesdk.UserPanelLayout{
		ID:            layout.ID,
		Title:         layout.Title,
		Icon:          layout.Icon,
		Description:   layout.Description,
		Payload:       json.RawMessage(layout.Payload),
		Code:          toStringPtr(layout.Code),
		Version:       layout.Version,
		OwnerID:       toOwnerIDPtr(layout.UserID),
		OwnerUsername: toStringPtr(layout.OwnerUsername),
		IsTracked:     isTracked,
		TrackerCount:  layout.TrackerCount,
		CreatedAt:     layout.CreatedAt.Time,
		UpdatedAt:     layout.UpdatedAt.Time,
	}
	httpapi.Write(ctx, w, http.StatusOK, resp)
}

func (h *Handler) TrackLayout(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims := chronauth.MustAuthenticatedClaims(ctx)

	var req chroniclesdk.TrackLayoutRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	layout, err := h.zed.GetPanelLayoutByID(ctx, req.LayoutID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "layout not found"})
			return
		}
		httpapi.InternalServerError(w, err)
		return
	}

	if layout.UserID.Valid && layout.UserID.UUID == claims.Subject {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "cannot track your own layout"})
		return
	}

	if !h.ensureUserLayoutLimitNotReached(ctx, w, claims.Subject) {
		return
	}

	if _, err := h.zed.TrackUserPanelLayout(ctx, database.TrackUserPanelLayoutParams{
		UserID:   claims.Subject,
		LayoutID: req.LayoutID,
	}); err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	httpapi.Write(ctx, w, http.StatusNoContent, nil)
}

func (h *Handler) UntrackLayout(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims := chronauth.MustAuthenticatedClaims(ctx)
	layoutIDRaw := chi.URLParam(r, "layoutID")
	layoutID, err := uuid.Parse(layoutIDRaw)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid layout id"})
		return
	}

	affected, err := h.zed.UntrackUserPanelLayout(ctx, database.UntrackUserPanelLayoutParams{
		UserID:   claims.Subject,
		LayoutID: layoutID,
	})
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	if affected == 0 {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "layout tracking not found"})
		return
	}

	httpapi.Write(ctx, w, http.StatusNoContent, nil)
}

func (h *Handler) CreateUserPanelLayout(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims := chronauth.MustAuthenticatedClaims(ctx)

	actor, ok := authz.ActorFromContext(ctx)
	if !ok {
		httpapi.Forbidden(w, nil)
		return
	}
	if ok, err := h.zed.CheckOne(ctx, nil, policy.New().GlobalChronicle().CanCreate_layout_User(actor)); !ok || err != nil {
		httpapi.Forbidden(w, nil)
		return
	}

	var req chroniclesdk.CreateUserPanelLayoutRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	if errMsg, ok := validatePanelLayoutRequest(req.Title, req.Payload); !ok {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: errMsg})
		return
	}

	if !h.ensureUserLayoutLimitNotReached(ctx, w, claims.Subject) {
		return
	}

	payload := req.Payload
	if len(payload) == 0 {
		payload = json.RawMessage(`{}`)
	}
	icon := req.Icon
	if icon == "" {
		icon = "INV_Misc_Book_09"
	}

	layout, err := h.zed.CreateUserPanelLayout(ctx, database.CreateUserPanelLayoutParams{
		UserID:      toNullUUID(claims.Subject),
		Title:       req.Title,
		Code:        pgtype.Text{},
		Icon:        icon,
		Description: req.Description,
		Payload:     payload,
	})
	if err != nil {
		if database.IsUniqueViolation(err, database.UniqueUserPanelLayoutsUserTitleCiUidx) {
			writeDuplicateLayoutTitleError(ctx, w)
			return
		}
		httpapi.InternalServerError(w, err)
		return
	}

	codeLength := GetShareCodeLength(ctx, h.zed)
	for i := 0; i < 10; i++ {
		code, genErr := shortcode.RandomBase62(codeLength)
		if genErr != nil {
			httpapi.InternalServerError(w, genErr)
			return
		}
		affected, setErr := h.zed.SetPanelLayoutCode(ctx, database.SetPanelLayoutCodeParams{
			Code: pgtype.Text{String: code, Valid: true},
			ID:   layout.ID,
		})
		if setErr == nil && affected == 1 {
			layout.Code = pgtype.Text{String: code, Valid: true}
			httpapi.Write(ctx, w, http.StatusCreated, panelLayoutToSDK(layout))
			return
		}
		if setErr != nil && isUniqueViolation(setErr) {
			continue
		}
		if setErr != nil {
			httpapi.InternalServerError(w, setErr)
			return
		}
	}

	httpapi.InternalServerError(w, errors.New("unable to generate unique layout code"))
}

func (h *Handler) UpdateUserPanelLayoutByID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	layoutIDRaw := chi.URLParam(r, "layoutID")
	layoutID, err := uuid.Parse(layoutIDRaw)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid layout id"})
		return
	}

	actor, ok := authz.ActorFromContext(ctx)
	if !ok {
		httpapi.Forbidden(w, nil)
		return
	}
	if ok, err := h.zed.CheckOne(ctx, nil, policy.New().Layout(layoutID).CanEdit_User(actor)); !ok || err != nil {
		httpapi.Forbidden(w, nil)
		return
	}

	var req chroniclesdk.UpdateUserPanelLayoutRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	if req.Title != nil {
		if errMsg, ok := validatePanelLayoutRequest(*req.Title, json.RawMessage(`{}`)); !ok {
			httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: errMsg})
			return
		}
	}
	if req.Payload != nil {
		if len(*req.Payload) > maxPanelLayoutPayloadBytes {
			httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "payload exceeds 10KB limit"})
			return
		}
		if !json.Valid(*req.Payload) {
			httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "payload must be valid JSON"})
			return
		}
		count, err := countPanelsInPayload(*req.Payload)
		if err == nil && count > maxPanelCount {
			httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: fmt.Sprintf("layout cannot exceed %d panels (has %d)", maxPanelCount, count)})
			return
		}
	}

	updateTitle := pgtype.Text{}
	if req.Title != nil && *req.Title != "" {
		updateTitle = pgtype.Text{String: *req.Title, Valid: true}
	}
	updateIcon := pgtype.Text{}
	if req.Icon != nil && *req.Icon != "" {
		updateIcon = pgtype.Text{String: *req.Icon, Valid: true}
	}
	updateDescription := pgtype.Text{}
	if req.Description != nil && *req.Description != "" {
		updateDescription = pgtype.Text{String: *req.Description, Valid: true}
	}
	var updatePayload []byte
	if req.Payload != nil && len(*req.Payload) > 0 {
		updatePayload = *req.Payload
	}

	layout, err := h.zed.UpdateUserPanelLayoutByID(ctx, database.UpdateUserPanelLayoutByIDParams{
		ID:          layoutID,
		Title:       updateTitle,
		Icon:        updateIcon,
		Description: updateDescription,
		Payload:     updatePayload,
	})
	if err != nil {
		if database.IsUniqueViolation(err, database.UniqueUserPanelLayoutsUserTitleCiUidx) {
			writeDuplicateLayoutTitleError(ctx, w)
			return
		}
		if errors.Is(err, sql.ErrNoRows) {
			httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "layout not found"})
			return
		}
		httpapi.InternalServerError(w, err)
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, panelLayoutToSDK(layout))
}

func (h *Handler) DeleteUserPanelLayoutByID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	layoutIDRaw := chi.URLParam(r, "layoutID")
	layoutID, err := uuid.Parse(layoutIDRaw)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid layout id"})
		return
	}

	actor, ok := authz.ActorFromContext(ctx)
	if !ok {
		httpapi.Forbidden(w, nil)
		return
	}
	if ok, err := h.zed.CheckOne(ctx, nil, policy.New().Layout(layoutID).CanDelete_User(actor)); !ok || err != nil {
		httpapi.Forbidden(w, nil)
		return
	}

	affected, err := h.zed.DeleteUserPanelLayoutByID(ctx, layoutID)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	if affected == 0 {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "layout not found"})
		return
	}

	httpapi.Write(ctx, w, http.StatusNoContent, nil)
}
