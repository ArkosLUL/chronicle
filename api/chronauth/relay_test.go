package chronauth

import (
	"log/slog"
	"net/url"
	"sync"
	"testing"
	"time"

	"github.com/Emyrk/chronicle/database"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRelayCodeStore_GenerateAndRedeem(t *testing.T) {
	t.Parallel()
	store := NewRelayCodeStore()
	defer store.Close()

	relay := &RelayCode{
		Session: database.UserAuthSession{
			ID:     uuid.New(),
			UserID: uuid.New(),
		},
		Provider:     "discord",
		TenantSlug:   "epoch",
		TenantName:   "Epoch",
		RedirectPath: "/raids",
		ExpiresAt:    time.Now().Add(60 * time.Second),
	}

	code := store.Generate(relay)
	require.NotEmpty(t, code)
	assert.Len(t, code, 64) // 32 bytes = 64 hex chars

	got, err := store.Redeem(code)
	require.NoError(t, err)
	assert.Equal(t, relay.Session.ID, got.Session.ID)
	assert.Equal(t, relay.Provider, got.Provider)
	assert.Equal(t, relay.TenantSlug, got.TenantSlug)
	assert.Equal(t, relay.RedirectPath, got.RedirectPath)
}

func TestRelayCodeStore_RedeemOnce(t *testing.T) {
	t.Parallel()
	store := NewRelayCodeStore()
	defer store.Close()

	code := store.Generate(&RelayCode{
		Provider:  "discord",
		ExpiresAt: time.Now().Add(60 * time.Second),
	})

	_, err := store.Redeem(code)
	require.NoError(t, err)

	// Second redeem must fail.
	_, err = store.Redeem(code)
	require.Error(t, err)
}

func TestRelayCodeStore_Expired(t *testing.T) {
	t.Parallel()
	store := NewRelayCodeStore()
	defer store.Close()

	code := store.Generate(&RelayCode{
		Provider:  "discord",
		ExpiresAt: time.Now().Add(-1 * time.Second), // Already expired
	})

	_, err := store.Redeem(code)
	require.Error(t, err)
}

func TestRelayCodeStore_NotFound(t *testing.T) {
	t.Parallel()
	store := NewRelayCodeStore()
	defer store.Close()

	_, err := store.Redeem("nonexistent")
	require.Error(t, err)
}

func TestRelayCodeStore_ConcurrentAccess(t *testing.T) {
	t.Parallel()
	store := NewRelayCodeStore()
	defer store.Close()

	const n = 100
	codes := make([]string, n)
	for i := 0; i < n; i++ {
		codes[i] = store.Generate(&RelayCode{
			Provider:  "discord",
			ExpiresAt: time.Now().Add(60 * time.Second),
		})
	}

	// Redeem all codes concurrently.
	var wg sync.WaitGroup
	results := make([]error, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_, results[idx] = store.Redeem(codes[idx])
		}(i)
	}
	wg.Wait()

	for i, err := range results {
		assert.NoError(t, err, "code %d should redeem successfully", i)
	}
}

func TestParseRelayTarget(t *testing.T) {
	t.Parallel()

	accessURL, _ := url.Parse("https://legacy.chronicleclassic.com")

	knownTenants := map[string]*TenantInfo{
		"epoch.chronicleclassic.com": {Slug: "epoch", Name: "Epoch"},
	}

	svc := &Service{
		accessURL: accessURL,
		logger:    slog.Default(),
		tenantChecker: func(host string) *TenantInfo {
			return knownTenants[host]
		},
	}

	tests := []struct {
		name       string
		from       string
		wantRelay  bool
		wantOrigin string
		wantPath   string
		wantSlug   string
	}{
		{
			name:      "relative path",
			from:      "/raids",
			wantRelay: false,
		},
		{
			name:      "empty string",
			from:      "",
			wantRelay: false,
		},
		{
			name:      "same domain (access URL)",
			from:      "https://legacy.chronicleclassic.com/raids",
			wantRelay: false,
		},
		{
			name:       "known tenant subdomain",
			from:       "https://epoch.chronicleclassic.com/raids",
			wantRelay:  true,
			wantOrigin: "https://epoch.chronicleclassic.com",
			wantPath:   "/raids",
			wantSlug:   "epoch",
		},
		{
			name:       "tenant with query params",
			from:       "https://epoch.chronicleclassic.com/raids?tab=boss",
			wantRelay:  true,
			wantOrigin: "https://epoch.chronicleclassic.com",
			wantPath:   "/raids?tab=boss",
			wantSlug:   "epoch",
		},
		{
			name:       "tenant root path",
			from:       "https://epoch.chronicleclassic.com",
			wantRelay:  true,
			wantOrigin: "https://epoch.chronicleclassic.com",
			wantPath:   "/",
			wantSlug:   "epoch",
		},
		{
			name:      "unknown host",
			from:      "https://evil.example.com/steal",
			wantRelay: false,
		},
		{
			name:      "invalid URL",
			from:      "://bad",
			wantRelay: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			origin, path, tenant, isRelay := svc.parseRelayTarget(tt.from)
			assert.Equal(t, tt.wantRelay, isRelay, "isRelay mismatch")
			if tt.wantRelay {
				assert.Equal(t, tt.wantOrigin, origin)
				assert.Equal(t, tt.wantPath, path)
				assert.Equal(t, tt.wantSlug, tenant.Slug)
			}
		})
	}
}

func TestParseRelayTarget_NilChecker(t *testing.T) {
	t.Parallel()
	svc := &Service{tenantChecker: nil}
	_, _, _, isRelay := svc.parseRelayTarget("https://epoch.chronicleclassic.com/raids")
	assert.False(t, isRelay, "should return false when tenantChecker is nil")
}
