package api

import (
	"net/http"

	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/api/httpmw"
)

func (a *API) WhoAmI(h http.ResponseWriter, r *http.Request) {
	user := httpmw.User(r)
	httpapi.Write(r.Context(), h, http.StatusOK, user)
}
