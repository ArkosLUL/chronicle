package retentionapi

import (
	"net/http"
	"time"

	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/chronicle/retention"
	"github.com/Emyrk/chronicle/chronicle/riverqueue"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/authz"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// Handler serves retention policy admin endpoints.
type Handler struct {
	zed    *authz.Authz
	queues *riverqueue.Queues
}

// New creates a new retention API handler.
func New(zed *authz.Authz, queues *riverqueue.Queues) *Handler {
	return &Handler{zed: zed, queues: queues}
}

// Routes returns the chi router for retention endpoints.
func (h *Handler) Routes() http.Handler {
	r := chi.NewRouter()

	r.Get("/policies", h.ListPolicies)
	r.Put("/policies", h.UpsertPolicy)
	r.Delete("/policies/{policyID}", h.DeletePolicy)
	r.Get("/policies/{policyID}/rules", h.GetRules)
	r.Put("/policies/{policyID}/rules", h.UpsertRule)
	r.Delete("/rules/{ruleID}", h.DeleteRule)
	r.Post("/preview", h.Preview)
	r.Post("/run", h.Run)

	return r
}

// ListPolicies returns all retention policies with their rules.
func (h *Handler) ListPolicies(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	policies, err := h.zed.ListAllRetentionPolicies(ctx)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	resp := make([]chroniclesdk.RetentionPolicy, 0, len(policies))
	for _, p := range policies {
		rules, err := h.zed.GetRetentionRulesByPolicy(ctx, p.ID)
		if err != nil {
			httpapi.InternalServerError(w, err)
			return
		}

		resp = append(resp, retentionPolicyToSDK(p, rules))
	}

	httpapi.Write(ctx, w, http.StatusOK, resp)
}

// UpsertPolicy creates or updates a retention policy.
func (h *Handler) UpsertPolicy(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req chroniclesdk.UpsertRetentionPolicyRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	if req.ServerID == nil && req.RealmID == nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Either server_id or realm_id must be provided.",
		})
		return
	}
	if req.ServerID != nil && req.RealmID != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Only one of server_id or realm_id can be provided.",
		})
		return
	}

	var policy database.RetentionPolicy
	var err error
	if req.RealmID != nil {
		policy, err = h.zed.UpsertRetentionPolicyByRealm(ctx, database.UpsertRetentionPolicyByRealmParams{
			RealmID: uuid.NullUUID{UUID: *req.RealmID, Valid: true},
			Enabled: req.Enabled,
		})
	} else {
		policy, err = h.zed.UpsertRetentionPolicy(ctx, database.UpsertRetentionPolicyParams{
			ServerID: uuid.NullUUID{UUID: *req.ServerID, Valid: true},
			RealmID:  uuid.NullUUID{},
			Enabled:  req.Enabled,
		})
	}
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, retentionPolicyToSDK(policy, nil))
}

// DeletePolicy deletes a retention policy and all its rules.
func (h *Handler) DeletePolicy(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	policyID, err := uuid.Parse(chi.URLParam(r, "policyID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Invalid policy ID.",
			Detail:  err.Error(),
		})
		return
	}

	err = h.zed.DeleteRetentionPolicy(ctx, policyID)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, chroniclesdk.Response{
		Message: "Policy deleted.",
	})
}

// GetRules returns all rules for a policy.
func (h *Handler) GetRules(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	policyID, err := uuid.Parse(chi.URLParam(r, "policyID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Invalid policy ID.",
			Detail:  err.Error(),
		})
		return
	}

	rules, err := h.zed.GetRetentionRulesByPolicy(ctx, policyID)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	resp := make([]chroniclesdk.RetentionRule, 0, len(rules))
	for _, rule := range rules {
		resp = append(resp, retentionRuleToSDK(rule))
	}
	httpapi.Write(ctx, w, http.StatusOK, resp)
}

// UpsertRule creates or updates a rule within a policy.
func (h *Handler) UpsertRule(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	policyID, err := uuid.Parse(chi.URLParam(r, "policyID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Invalid policy ID.",
			Detail:  err.Error(),
		})
		return
	}

	var req chroniclesdk.UpsertRetentionRuleRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	if req.Action != retention.ActionKeep && req.Action != retention.ActionDelete {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Action must be 'keep' or 'delete'.",
		})
		return
	}

	// Validate conditions parse correctly.
	if _, err := retention.ParseConditions(req.Conditions); err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Invalid conditions JSON.",
			Detail:  err.Error(),
		})
		return
	}

	rule, err := h.zed.UpsertRetentionRule(ctx, database.UpsertRetentionRuleParams{
		PolicyID:    policyID,
		Priority:    int32(req.Priority),
		Action:      req.Action,
		Conditions:  req.Conditions,
		Description: req.Description,
	})
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, retentionRuleToSDK(rule))
}

// DeleteRule deletes a single rule.
func (h *Handler) DeleteRule(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ruleID, err := uuid.Parse(chi.URLParam(r, "ruleID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Invalid rule ID.",
			Detail:  err.Error(),
		})
		return
	}

	err = h.zed.DeleteRetentionRule(ctx, ruleID)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, chroniclesdk.Response{
		Message: "Rule deleted.",
	})
}

// Preview runs a dry-run of retention evaluation.
func (h *Handler) Preview(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req chroniclesdk.RetentionPreviewRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	if req.RealmID == nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "realm_id is required for preview.",
		})
		return
	}

	items, err := retention.Preview(ctx, h.zed, *req.RealmID, time.Now())
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	resp := chroniclesdk.RetentionPreviewResponse{
		TotalEvaluated: len(items),
	}
	for _, item := range items {
		sdkItem := chroniclesdk.RetentionPreviewItem{
			InstanceID:   item.InstanceID,
			InstanceName: item.InstanceName,
			EndTime:      item.EndTime,
			MatchedRule:  item.MatchedRule,
		}
		switch item.Action {
		case retention.ActionDelete:
			resp.ToDelete = append(resp.ToDelete, sdkItem)
		case retention.ActionKeep:
			resp.ToKeep = append(resp.ToKeep, sdkItem)
		default:
			resp.NoMatch = append(resp.NoMatch, sdkItem)
		}
	}

	httpapi.Write(ctx, w, http.StatusOK, resp)
}

// Run triggers a manual retention job.
func (h *Handler) Run(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req chroniclesdk.RetentionRunRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	_, err := h.queues.Insert(ctx, retention.ArgsRetention{DryRun: req.DryRun}, nil)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	httpapi.Write(ctx, w, http.StatusAccepted, chroniclesdk.Response{
		Message: "Retention job enqueued.",
	})
}

func retentionPolicyToSDK(p database.RetentionPolicy, rules []database.RetentionRule) chroniclesdk.RetentionPolicy {
	sdk := chroniclesdk.RetentionPolicy{
		ID:        p.ID,
		Enabled:   p.Enabled,
		CreatedAt: p.CreatedAt.Time,
		UpdatedAt: p.UpdatedAt.Time,
	}
	if p.ServerID.Valid {
		sdk.ServerID = &p.ServerID.UUID
	}
	if p.RealmID.Valid {
		sdk.RealmID = &p.RealmID.UUID
	}
	for _, r := range rules {
		sdk.Rules = append(sdk.Rules, retentionRuleToSDK(r))
	}
	return sdk
}

func retentionRuleToSDK(r database.RetentionRule) chroniclesdk.RetentionRule {
	return chroniclesdk.RetentionRule{
		ID:          r.ID,
		PolicyID:    r.PolicyID,
		Priority:    int(r.Priority),
		Action:      r.Action,
		Conditions:  r.Conditions,
		Description: r.Description,
		CreatedAt:   r.CreatedAt.Time,
	}
}
