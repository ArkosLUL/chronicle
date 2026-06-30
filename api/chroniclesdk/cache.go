package chroniclesdk

// AdminCacheStatsResponse is the response from GET /api/v1/admin/cache-stats.
type AdminCacheStatsResponse struct {
	Caches []AdminCacheStat `json:"caches"`
}

// AdminCacheStat describes a single LRU cache's current state.
type AdminCacheStat struct {
	Name     string `json:"name"`
	Entries  int    `json:"entries"`
	Capacity int    `json:"capacity"`
	TTL      string `json:"ttl"` // Go duration string, "" if no TTL
}
