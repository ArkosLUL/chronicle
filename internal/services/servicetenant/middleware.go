package servicetenant

import (
	"net/http"
	"strings"
)

// Middleware extracts the tenant from the request Host header and injects it
// into the context. Lightweight — no DB calls, uses the cached slug map.
func (s *Service) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		slug := s.extractSlug(r.Host)
		if slug == "" {
			// Root domain or unrecognized host — no tenant context.
			next.ServeHTTP(w, r)
			return
		}

		tenant, ok := s.GetTenantBySlug(slug)
		if !ok {
			// Slug doesn't match any tenant — treat as root domain.
			next.ServeHTTP(w, r)
			return
		}

		ctx := WithTenant(r.Context(), tenant)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// extractSlug pulls the subdomain from a host like "epoch.chronicleclassic.com".
// Returns "" for the root domain or if the host doesn't match the primary domain.
func (s *Service) extractSlug(host string) string {
	// Strip port if present.
	if idx := strings.LastIndex(host, ":"); idx != -1 {
		host = host[:idx]
	}
	host = strings.ToLower(host)

	primaryDomain := s.primaryDomain
	if primaryDomain == "" {
		return ""
	}
	// Strip port from primaryDomain too (e.g. "localhost:4000" → "localhost").
	if idx := strings.LastIndex(primaryDomain, ":"); idx != -1 {
		primaryDomain = primaryDomain[:idx]
	}

	// Host must end with ".primaryDomain"
	suffix := "." + primaryDomain
	if !strings.HasSuffix(host, suffix) {
		return ""
	}

	// Extract subdomain (everything before the suffix).
	slug := strings.TrimSuffix(host, suffix)

	// Must be a single label (no dots = not "a.b.primaryDomain").
	if slug == "" || strings.Contains(slug, ".") {
		return ""
	}
	return slug
}
