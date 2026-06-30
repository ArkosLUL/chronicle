package api

import (
	"net/http"

	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/go-chi/chi/v5"
)

// AdminGetCacheStats returns the current state of all registered LRU caches.
// @Summary Get cache statistics
// @Tags Admin
// @Success 200 {object} chroniclesdk.AdminCacheStatsResponse
// @Router /api/v1/admin/cache-stats [get]
func (a *API) AdminGetCacheStats(w http.ResponseWriter, r *http.Request) {
	if a.Opts.CacheSvc == nil {
		httpapi.Write(r.Context(), w, http.StatusOK, chroniclesdk.AdminCacheStatsResponse{})
		return
	}

	stats := a.Opts.CacheSvc.Stats()
	resp := chroniclesdk.AdminCacheStatsResponse{
		Caches: make([]chroniclesdk.AdminCacheStat, len(stats)),
	}
	for i, s := range stats {
		var ttl string
		if s.TTL > 0 {
			ttl = s.TTL.String()
		}
		resp.Caches[i] = chroniclesdk.AdminCacheStat{
			Name:     s.Name,
			Entries:  s.Entries,
			Capacity: s.Capacity,
			TTL:      ttl,
		}
	}

	httpapi.Write(r.Context(), w, http.StatusOK, resp)
}

// AdminPurgeCache purges a single cache by name, or all caches if no name is given.
// @Summary Purge caches
// @Tags Admin
// @Param name path string false "Cache name to purge; omit to purge all"
// @Success 204
// @Router /api/v1/admin/cache-stats/purge/{name} [post]
func (a *API) AdminPurgeCache(w http.ResponseWriter, r *http.Request) {
	if a.Opts.CacheSvc == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	name := chi.URLParam(r, "name")
	a.Opts.CacheSvc.Purge(name)
	w.WriteHeader(http.StatusNoContent)
}
