package api

import (
	"net/http"
	"strconv"

	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/db2sdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/instances"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/internal/semverenc"
	"github.com/Emyrk/chronicle/internal/slice"
)

// SpeedrunLeaderboard returns the best qualified speedrun per duplicate group
// for a given instance name. Optional realm_name query params filter by realm.
//
//	GET /api/v1/leaderboard/speedrun?instance_name=Molten+Core&realm_name=Turtle+WoW
func (api *API) SpeedrunLeaderboard(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	instanceName := r.URL.Query().Get("instance_name")
	if instanceName == "" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "instance_name query parameter is required",
		})
		return
	}

	realmNames := r.URL.Query()["realm_name"]

	var minPlayers, maxPlayers int64
	if v := r.URL.Query().Get("min_players"); v != "" {
		minPlayers, _ = strconv.ParseInt(v, 10, 64)
	}
	if v := r.URL.Query().Get("max_players"); v != "" {
		maxPlayers, _ = strconv.ParseInt(v, 10, 64)
	}

	guildID := r.URL.Query().Get("guild_id")

	var sinceDays int64
	if v := r.URL.Query().Get("since_days"); v != "" {
		sinceDays, _ = strconv.ParseInt(v, 10, 64)
	}

	rows, err := api.Opts.Zed.SpeedrunLeaderboard(ctx, database.SpeedrunLeaderboardParams{
		InstanceName: instanceName,
		RealmNames:   realmNames,
		MinPlayers:   minPlayers,
		MaxPlayers:   maxPlayers,
		GuildID:      guildID,
		SinceDays:    sinceDays,
	})
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Failed to fetch speedrun leaderboard",
				Detail:  err.Error(),
			},
		})
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, slice.List(rows, db2sdk.SpeedrunLeaderboardEntry))
}

// SpeedrunInstances returns the list of instance names that have qualified speedruns.
//
//	GET /api/v1/leaderboard/speedrun/instances
func (api *API) SpeedrunInstances(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	names, err := api.Opts.Zed.SpeedrunInstanceNames(ctx)
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Failed to fetch speedrun instance names",
				Detail:  err.Error(),
			},
		})
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, names)
}

// SpeedrunRealms returns the list of realm names that have qualified speedruns.
//
//	GET /api/v1/leaderboard/speedrun/realms
func (api *API) SpeedrunRealms(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	names, err := api.Opts.Zed.SpeedrunRealmNames(ctx)
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Failed to fetch speedrun realm names",
				Detail:  err.Error(),
			},
		})
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, names)
}

// SpeedrunRules returns the speedrun requirements for a given instance.
//
//	GET /api/v1/leaderboard/speedrun/rules?instance_name=...
func (api *API) SpeedrunRules(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	instanceName := r.URL.Query().Get("instance_name")
	if instanceName == "" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "instance_name query parameter is required",
		})
		return
	}

	allRules := instances.SpeedrunRulesByInstance()
	reqs, ok := allRules[instanceName]
	if !ok {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{
			Message: "No speedrun rules found for instance",
		})
		return
	}

	sdkReqs := make([]chroniclesdk.SpeedrunRequirement, len(reqs))
	for i, r := range reqs {
		sdkReqs[i] = chroniclesdk.SpeedrunRequirement{
			Name:     r.Name,
			EntryIDs: r.EntryIDs,
			Count:    r.Count,
			Category: string(r.Category),
		}
	}

	httpapi.Write(ctx, w, http.StatusOK, chroniclesdk.SpeedrunRulesResponse{
		InstanceName: instanceName,
		Requirements: sdkReqs,
	})
}

// AdminListLeaderboardVersionRequirements returns all configured version requirements.
//
//	GET /api/v1/admin/leaderboard/version-requirements
func (api *API) AdminListLeaderboardVersionRequirements(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	rows, err := api.Opts.Zed.ListLeaderboardVersionRequirements(ctx)
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Failed to list version requirements",
				Detail:  err.Error(),
			},
		})
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, slice.List(rows, db2sdk.LeaderboardVersionRequirements))
}

// AdminUpsertLeaderboardVersionRequirements creates or updates version requirements
// for a given instance name. The human-readable version strings are encoded to
// integers server-side for SQL comparison.
//
//	PUT /api/v1/admin/leaderboard/version-requirements
func (api *API) AdminUpsertLeaderboardVersionRequirements(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req chroniclesdk.LeaderboardVersionRequirements
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	if req.InstanceName == "" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "instance_name is required",
		})
		return
	}

	row, err := api.Opts.Zed.UpsertLeaderboardVersionRequirements(ctx, database.UpsertLeaderboardVersionRequirementsParams{
		InstanceName:        req.InstanceName,
		MinParserVersion:    req.MinParserVersion,
		MinParserVersionNum: semverenc.Encode(req.MinParserVersion),
		MinAddonVersion:     req.MinAddonVersion,
		MinAddonVersionNum:  semverenc.Encode(req.MinAddonVersion),
	})
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Failed to upsert version requirements",
				Detail:  err.Error(),
			},
		})
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, db2sdk.LeaderboardVersionRequirements(row))
}
