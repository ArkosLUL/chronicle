package api

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/database/authz"
	"github.com/authzed/gochugaru/rel"
)

func (api *API) checkAuthorization(rw http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	actor, _ := authz.ActorFromContext(ctx)

	var params chroniclesdk.AuthorizationRequest
	if !httpapi.Read(ctx, rw, r, &params) {
		return
	}

	// Prevent abuse from this endpoint.
	const maxChecks = 25
	if len(params.Checks) > maxChecks {
		httpapi.Write(ctx, rw, http.StatusBadRequest, chroniclesdk.Response{
			Message: fmt.Sprintf(
				"Endpoint only supports %d checks at a time, found %d.",
				maxChecks, len(params.Checks),
			),
		})
		return
	}

	// Build permission checks for SpiceDB
	// We need to maintain order for response mapping
	type checkEntry struct {
		key string
		rel rel.Relationship
	}
	var checks []checkEntry

	response := make(chroniclesdk.AuthorizationResponse)

	actorObj := actor.Object()
	subject := actorObj.Typ + ":" + actorObj.ID

	for k, v := range params.Checks {
		if v == "" {
			httpapi.Write(ctx, rw, http.StatusBadRequest, chroniclesdk.Response{
				Message: fmt.Sprintf("Object string must be defined for key %q.", k),
			})
			return
		}

		// "lookup:type#permission" — returns true if LookupResources yields ≥1 result.
		if strings.HasPrefix(v, "lookup:") {
			permission := strings.TrimPrefix(v, "lookup:")
			found := false
			for _, err := range api.Zed.LookupResources(ctx, nil, permission, subject) {
				if err != nil {
					httpapi.InternalServerError(rw, err)
					return
				}
				found = true
				break // we only need one
			}
			response[k] = found
			continue
		}

		// Parse SpiceDB-style object string: "type:id#permission"
		objectType, objectID, permission, err := rel.ParseObjectSet(v)
		if err != nil {
			httpapi.Write(ctx, rw, http.StatusBadRequest, chroniclesdk.Response{
				Message: fmt.Sprintf("Invalid object format for key %q: %v. Expected format: type:id#permission", k, err),
			})
			return
		}

		if permission == "" {
			httpapi.Write(ctx, rw, http.StatusBadRequest, chroniclesdk.Response{
				Message: fmt.Sprintf("Permission (relation) must be specified for key %q. Expected format: type:id#permission", k),
			})
			return
		}

		// Build the relationship for the permission check
		// Resource is the object being checked, subject is the user
		checks = append(checks, checkEntry{
			key: k,
			rel: rel.Relationship{
				ResourceType:     objectType,
				ResourceID:       objectID,
				ResourceRelation: permission,
				SubjectType:      actorObj.Typ,
				SubjectID:        actorObj.ID,
			},
		})
	}

	// If no standard checks to perform, return response (may already have lookup results)
	if len(checks) == 0 {
		httpapi.Write(ctx, rw, http.StatusOK, response)
		return
	}

	// Perform batch check with SpiceDB
	rels := make([]rel.Interface, len(checks))
	for i, c := range checks {
		rels[i] = c.rel
	}

	results, err := api.Zed.Check(ctx, nil, rels...)
	if err != nil {
		httpapi.InternalServerError(rw, err)
		return
	}

	// Map results back to response
	for i, c := range checks {
		response[c.key] = results[i]
	}

	httpapi.Write(ctx, rw, http.StatusOK, response)
}
