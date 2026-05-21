package api

import (
	"net/http"
)

// tenantMiddleware delegates to servicetenant.Middleware if configured,
// otherwise it's a no-op (single-tenant mode).
func (api *API) tenantMiddleware(next http.Handler) http.Handler {
	if api.Opts.Tenant == nil {
		return next
	}
	return api.Opts.Tenant.Middleware(next)
}
