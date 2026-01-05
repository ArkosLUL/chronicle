package chronauth

import (
	"net/http"

	"github.com/google/uuid"
)

type AuthenticatedResponse struct {
	UserID    uuid.UUID
	SessionID uuid.UUID
}

// TODO: Better errors
func (s *Service) Authenticated(w http.ResponseWriter, r *http.Request) (*AuthenticatedResponse, bool) {
	auth, err := s.Store.Get(r, AuthSessionName)
	if err != nil {
		// TODO: Error to try again
		_ = s.Logout(w, r)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return nil, false
	}

	jwt, ok := auth.Values["jwt"]
	if !ok {
		return nil, true
	}

	jwtStr, ok := jwt.(string)
	if !ok {
		// TODO: Error to try again
		_ = s.Logout(w, r)
		http.Error(w, "JWT token is not valid", http.StatusUnauthorized)
		return nil, false
	}

	uid, sid, err := s.sessions.ValidateSession(jwtStr)
	if err != nil {
		// TODO: Error to try again
		_ = s.Logout(w, r)
		http.Error(w, "Invalid session: "+err.Error(), http.StatusUnauthorized)
		return nil, false
	}

	return &AuthenticatedResponse{
		UserID:    uid,
		SessionID: sid,
	}, true
}
