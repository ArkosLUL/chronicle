package chronauth

import (
	"encoding/json"
	"strings"

	"github.com/markbates/goth"
	"github.com/markbates/goth/providers/github"
	"golang.org/x/oauth2"
)

var _ goth.Provider = (*devProvider)(nil)

type devProvider struct {
	name   string
	config *oauth2.Config
}

func (d *devProvider) RefreshTokenAvailable() bool { return true }

func (d *devProvider) Name() string {
	return d.name
}

func (d *devProvider) SetName(name string) {
	d.name = name
}

func (d *devProvider) BeginAuth(state string) (goth.Session, error) {
	url := d.config.AuthCodeURL(state)
	session := &github.Session{
		AuthURL: url,
	}
	return session, nil
}

func (d *devProvider) UnmarshalSession(data string) (goth.Session, error) {
	s := &github.Session{}
	err := json.NewDecoder(strings.NewReader(data)).Decode(s)
	return s, err
}

func (d *devProvider) FetchUser(session goth.Session) (goth.User, error) {
	//TODO implement me
	panic("implement me")
}

func (d *devProvider) Debug(b bool) {

}

func (d *devProvider) RefreshToken(refreshToken string) (*oauth2.Token, error) {
	token := &oauth2.Token{RefreshToken: refreshToken}
	ts := d.config.TokenSource(oauth2.NoContext, token)
	newToken, err := ts.Token()
	if err != nil {
		return nil, err
	}
	return newToken, err
}
