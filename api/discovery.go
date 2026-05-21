package api

import (
	"net/http"

	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/internal/services/servicetenant"
)

// Discovery returns branding for this deployment and all its tenants.
// On a tenant subdomain: returns a single-element array for that tenant.
// On the primary domain: returns site-level branding plus every tenant.
// Used by the landing site (chronicleclassic.com) to aggregate server info.
//
//	@Summary  Discovery info for landing page aggregation
//	@Tags     Public
//	@Success  200 {array} chroniclesdk.DiscoveryEntry
//	@Router   /api/v1/discovery [get]
func (a *API) Discovery(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Cache for 1 hour — this data changes slowly.
	w.Header().Set("Cache-Control", "public, max-age=3600")

	// On a tenant subdomain, return just that tenant (if discoverable).
	if t := servicetenant.TenantFromContext(ctx); t != nil {
		if !t.Discoverable {
			httpapi.Write(ctx, w, http.StatusOK, []chroniclesdk.DiscoveryEntry{})
			return
		}
		sdkTenant := chroniclesdk.TenantFromDB(*t)
		url := ""
		if a.Opts.AccessURL != nil {
			if a.Opts.Tenant != nil && t.Slug.Valid && a.Opts.Tenant.PrimaryDomain() != "" {
				url = a.Opts.AccessURL.Scheme + "://" + t.Slug.String + "." + a.Opts.Tenant.PrimaryDomain()
			}
		}
		httpapi.Write(ctx, w, http.StatusOK, []chroniclesdk.DiscoveryEntry{{
			Branding: sdkTenant.Branding,
			URL:      url,
		}})
		return
	}

	// Primary domain: return site-level branding (if discoverable) + all discoverable tenants.
	var entries []chroniclesdk.DiscoveryEntry

	// Site-level branding.
	config, err := a.Opts.Zed.GetSiteConfig(ctx)
	if err == nil && config.Discoverable {
		if b := unmarshalBranding(config.Branding); b != nil {
			url := ""
			if a.Opts.AccessURL != nil {
				url = a.Opts.AccessURL.String()
			}
			entries = append(entries, chroniclesdk.DiscoveryEntry{
				Branding: b,
				URL:      url,
			})
		}
	}

	// All discoverable tenants.
	if a.Opts.Tenant != nil {
		tenants, err := a.Opts.Zed.ListTenants(servicetenant.AdminBypass(ctx))
		if err == nil {
			primaryDomain := a.Opts.Tenant.PrimaryDomain()
			scheme := "https"
			if a.Opts.AccessURL != nil {
				scheme = a.Opts.AccessURL.Scheme
			}
			for _, t := range tenants {
				if !t.Discoverable {
					continue
				}
				sdkTenant := chroniclesdk.TenantFromDB(t)
				if sdkTenant.Branding == nil {
					continue
				}
				url := ""
				if t.Slug.Valid && primaryDomain != "" {
					url = scheme + "://" + t.Slug.String + "." + primaryDomain
				}
				entries = append(entries, chroniclesdk.DiscoveryEntry{
					Branding: sdkTenant.Branding,
					URL:      url,
				})
			}
		}
	}

	if entries == nil {
		entries = []chroniclesdk.DiscoveryEntry{}
	}

	httpapi.Write(ctx, w, http.StatusOK, entries)
}
