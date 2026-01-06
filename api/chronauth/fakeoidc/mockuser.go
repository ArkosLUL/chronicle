package fakeoidc

import (
	"encoding/json"

	"github.com/oauth2-proxy/mockoidc"
)

var _ mockoidc.User = (*MockUser)(nil)

type MockUser struct {
	*mockoidc.MockUser
}

func (m MockUser) Userinfo(scopes []string) ([]byte, error) {
	var claims map[string]any
	data, err := m.MockUser.Userinfo(scopes)
	if err != nil {
		return nil, err
	}

	err = json.Unmarshal(data, &claims)
	if err != nil {
		return nil, err
	}

	claims["sub"] = m.ID()

	return json.Marshal(claims)
}
