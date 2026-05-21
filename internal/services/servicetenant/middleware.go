package servicetenant

import (
	"fmt"
	"html"
	"net/http"
	"strings"
)

// Middleware extracts the tenant from the request Host header and injects it
// into the context. Lightweight — no DB calls, uses the cached slug map.
func (s *Service) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The access URL host (e.g. legacy.chronicleclassic.com) is the primary
		// deployment, not a tenant — skip slug extraction for it.
		if s.accessURL.Host != "" && stripPort(r.Host) == s.accessURL.Hostname() {
			next.ServeHTTP(w, r)
			return
		}

		slug := s.extractSlug(r.Host)
		if slug == "" {
			// Root domain or unrecognized host — no tenant context.
			next.ServeHTTP(w, r)
			return
		}

		tenant, ok := s.GetTenantBySlug(slug)
		if !ok {
			// Valid subdomain pattern but no matching tenant — 404.
			s.writeUnknownTenant(w, r, slug)
			return
		}

		ctx := WithTenant(r.Context(), tenant)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// writeUnknownTenant sends a 404 for an unrecognized tenant subdomain.
// API paths get a JSON body; everything else gets a self-contained HTML page.
func (s *Service) writeUnknownTenant(w http.ResponseWriter, r *http.Request, slug string) {
	if strings.HasPrefix(r.URL.Path, "/api/") {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusNotFound)
		_, _ = fmt.Fprintf(w, `{"message":"unknown community %q","detail":"No community is registered at this address."}`, slug)
		return
	}

	accessURL := s.accessURL.String()

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusNotFound)
	_, _ = fmt.Fprintf(w, unknownTenantHTML,
		html.EscapeString(accessURL), // %s 1 — favicon href
		html.EscapeString(slug),      // %s 2 — slug display
		html.EscapeString(accessURL), // %s 3 — link href
		html.EscapeString(accessURL), // %s 4 — link text
	)
}

// unknownTenantHTML is a self-contained 404 page shown when a subdomain doesn't
// match any tenant. Styled to match Chronicle's dark theme and brand colors.
//
//	%s slots: 1=accessURL (favicon), 2=slug, 3=accessURL (link href), 4=accessURL (link text)
const unknownTenantHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" type="image/x-icon" href="%s/c/chronicle/favicon.ico">
<title>Community Not Found · Chronicle</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:#1a1a1a;color:#e8e8ea;font-family:system-ui,-apple-system,sans-serif;
  }
  .card{
    max-width:440px;text-align:center;padding:2.5rem 2rem;
    border:1px solid #2a2a2a;border-radius:12px;background:#161616;
  }
  .code{
    font-size:4.5rem;font-weight:700;letter-spacing:-.03em;
    color:#5F8FA6;
  }
  h1{margin:.75rem 0 .5rem;font-size:1.25rem;font-weight:600;color:#e8e8ea}
  p{color:#888;font-size:.925rem;line-height:1.6;margin-top:.25rem}
  .slug{color:#bbb;font-weight:500}
  .link{
    display:inline-block;margin-top:1.25rem;
    color:#5F8FA6;text-decoration:none;font-size:.875rem;font-weight:500;
    padding:.5rem 1.25rem;border:1px solid #5F8FA6;border-radius:8px;
    transition:background .15s,color .15s;
  }
  .link:hover{background:#5F8FA6;color:#161616}
  .footer{margin-top:2rem;font-size:.75rem;color:#555}
</style>
</head>
<body>
<div class="card">
  <div class="code">404</div>
  <h1>Community Not Found</h1>
  <p>There is no community registered at <span class="slug">%s</span>.</p>
  <a class="link" href="%s">Return to %s</a>
</div>
<div class="footer">Chronicle</div>
</body>
</html>
`

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

// stripPort removes the port from a host string (e.g. "foo.com:4000" → "foo.com").
func stripPort(host string) string {
	if idx := strings.LastIndex(host, ":"); idx != -1 {
		return strings.ToLower(host[:idx])
	}
	return strings.ToLower(host)
}
