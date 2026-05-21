package chroniclesdk

// DiscoveryEntry is one server/tenant in the discovery response.
type DiscoveryEntry struct {
	// Branding for this server/tenant.
	Branding *Branding `json:"branding"`
	// URL is the canonical URL for this server/tenant's Chronicle deployment.
	URL string `json:"url"`
}
