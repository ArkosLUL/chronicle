package api

import (
	"net/http"

	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/database"
)

// ListFlavors returns every known flavor tag. The list is static (compiled-in),
// so clients can cache aggressively.
func (*API) ListFlavors(w http.ResponseWriter, r *http.Request) {
	tags := database.AllFlavorTagValues()
	out := make([]string, len(tags))
	for i, t := range tags {
		out[i] = string(t)
	}

	w.Header().Set("Cache-Control", "public, max-age=300") // 5 min
	httpapi.Write(r.Context(), w, http.StatusOK, out)
}
