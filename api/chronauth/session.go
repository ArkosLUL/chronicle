package chronauth

import (
	"net/http"

	"github.com/Emyrk/chronicle/api/chronauth/claims"
)

// TODO: Better errors
func (s *Service) Authenticated(w http.ResponseWriter, r *http.Request) (*claims.Claims, bool) {
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

	claims, err := s.sessions.ValidateSession(jwtStr)
	if err != nil {
		// TODO: Error to try again
		_ = s.Logout(w, r)
		http.Error(w, "Invalid session: "+err.Error(), http.StatusUnauthorized)
		return nil, false
	}

	return &claims, true
}
