package chroniclesdk

// AuthorizationRequest is a request to check multiple authorizations at once.
type AuthorizationRequest struct {
	// Checks is a map of check names to SpiceDB-style object strings.
	// Keys are arbitrary identifiers returned in the response.
	// Values are in the format "type:id#permission", e.g.:
	//   - "raid_log:550e8400-e29b-41d4-a716-446655440000#view"
	//   - "instance:550e8400-e29b-41d4-a716-446655440000#edit"
	//
	// The "lookup:" prefix uses LookupResources to check if the user has the
	// given permission on at least one resource of that type, e.g.:
	//   - "lookup:wow_server#administer" — true if user can admin any server
	Checks map[string]string `json:"checks"`
}

// AuthorizationResponse is the response to an authorization request.
// Keys correspond to the keys in the AuthorizationRequest.Checks map.
// Values are true if the authorization check passed, false otherwise.
type AuthorizationResponse map[string]bool
