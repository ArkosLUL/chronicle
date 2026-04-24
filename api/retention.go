package api

import (
	"net/http"
	"time"

	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/chronicle/retention"
	"github.com/Emyrk/chronicle/database"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// AdminListRetentionPolicies returns all retention policies.
func (a *API) AdminListRetentionPolicies(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	policies, err := a.Opts.Zed.ListAllRetentionPolicies(ctx)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	resp := make([]chroniclesdk.RetentionPolicy, 0, len(policies))
	for _, p := range policies {
		rules, err := a.Opts.Zed.GetRetentionRulesByPolicy(ctx, p.ID)
		if err != nil {
			httpapi.InternalServerError(w, err)
			return
		}

		sdkPolicy := retentionPolicyToSDK(p, rules)
		resp = append(resp, sdkPolicy)
	}

	httpapi.Write(ctx, w, http.StatusOK, resp)
}

// AdminUpsertRetentionPolicy creates or updates a retention policy.
func (a *API) AdminUpsertRetentionPolicy(w http.ResponseWriter, r *http.Request) {
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
		policy, err = a.Opts.Zed.UpsertRetentionPolicyByRealm(ctx, database.UpsertRetentionPolicyByRealmParams{
			RealmID: *req.RealmID,
			Enabled: req.Enabled,
		})
	} else {
		policy, err = a.Opts.Zed.UpsertRetentionPolicy(ctx, database.UpsertRetentionPolicyParams{
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

// AdminDeleteRetentionPolicy deletes a retention policy and all its rules.
func (a *API) AdminDeleteRetentionPolicy(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	policyID, err := uuid.Parse(chi.URLParam(r, "policyID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Invalid policy ID.",
			Detail:  err.Error(),
		})
		return
	}

	err = a.Opts.Zed.DeleteRetentionPolicy(ctx, policyID)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, chroniclesdk.Response{
		Message: "Policy deleted.",
	})
}

// AdminGetRetentionRules returns all rules for a policy.
func (a *API) AdminGetRetentionRules(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	policyID, err := uuid.Parse(chi.URLParam(r, "policyID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Invalid policy ID.",
			Detail:  err.Error(),
		})
		return
	}

	rules, err := a.Opts.Zed.GetRetentionRulesByPolicy(ctx, policyID)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	resp := make([]chroniclesdk.RetentionRule, 0, len(rules))
	for _, r := range rules {
		resp = append(resp, retentionRuleToSDK(r))
	}
	httpapi.Write(ctx, w, http.StatusOK, resp)
}

// AdminUpsertRetentionRule creates or updates a rule within a policy.
func (a *API) AdminUpsertRetentionRule(w http.ResponseWriter, r *http.Request) {
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

	rule, err := a.Opts.Zed.UpsertRetentionRule(ctx, database.UpsertRetentionRuleParams{
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

// AdminDeleteRetentionRule deletes a single rule.
func (a *API) AdminDeleteRetentionRule(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ruleID, err := uuid.Parse(chi.URLParam(r, "ruleID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Invalid rule ID.",
			Detail:  err.Error(),
		})
		return
	}

	err = a.Opts.Zed.DeleteRetentionRule(ctx, ruleID)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, chroniclesdk.Response{
		Message: "Rule deleted.",
	})
}

// AdminRetentionPreview runs a dry-run of retention evaluation.
func (a *API) AdminRetentionPreview(w http.ResponseWriter, r *http.Request) {
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

	items, err := retention.Preview(ctx, a.Opts.Zed, *req.RealmID, time.Now())
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

// AdminRetentionRun triggers a manual retention job.
func (a *API) AdminRetentionRun(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req chroniclesdk.RetentionRunRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	_, err := a.Queues.Insert(ctx, retention.ArgsRetention{DryRun: req.DryRun}, nil)
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
