package chronauth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"

	"github.com/Emyrk/chronicle/database"
)

// TenantInfo is a lightweight struct carrying tenant metadata through the
// relay flow. It avoids importing the full database.Tenant type into callers.
type TenantInfo struct {
	Slug string
	Name string
}

// RelayCode holds the data needed to set a session cookie on a tenant subdomain
// after OAuth completes on the main domain.
type RelayCode struct {
	Session      database.UserAuthSession
	Provider     string
	TenantSlug   string
	TenantName   string
	RedirectPath string // Path to redirect to after setting cookie (e.g. "/raids")
	ExpiresAt    time.Time
}

// RelayCodeStore is an in-memory, one-time-use code store for cross-subdomain
// auth relay. Codes are short-lived (60s) and consumed on first use.
type RelayCodeStore struct {
	mu    sync.Mutex
	codes map[string]*RelayCode
	done  chan struct{}
}

// NewRelayCodeStore creates a store and starts a background cleanup goroutine.
func NewRelayCodeStore() *RelayCodeStore {
	s := &RelayCodeStore{
		codes: make(map[string]*RelayCode),
		done:  make(chan struct{}),
	}
	go s.cleanup()
	return s
}

// Generate creates a one-time relay code (32 random bytes, hex-encoded) with the
// given payload. Returns the hex code string.
func (s *RelayCodeStore) Generate(relay *RelayCode) string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic("crypto/rand failed: " + err.Error())
	}
	code := hex.EncodeToString(b)

	s.mu.Lock()
	s.codes[code] = relay
	s.mu.Unlock()

	return code
}

var errRelayCodeInvalid = errors.New("relay code not found or expired")

// Redeem atomically retrieves and deletes a relay code. Returns an error if the
// code doesn't exist or has expired.
func (s *RelayCodeStore) Redeem(code string) (*RelayCode, error) {
	s.mu.Lock()
	relay, ok := s.codes[code]
	if ok {
		delete(s.codes, code)
	}
	s.mu.Unlock()

	if !ok {
		return nil, errRelayCodeInvalid
	}
	if time.Now().After(relay.ExpiresAt) {
		return nil, errRelayCodeInvalid
	}
	return relay, nil
}

// Close stops the background cleanup goroutine.
func (s *RelayCodeStore) Close() {
	close(s.done)
}

func (s *RelayCodeStore) cleanup() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-s.done:
			return
		case now := <-ticker.C:
			s.mu.Lock()
			for code, relay := range s.codes {
				if now.After(relay.ExpiresAt) {
					delete(s.codes, code)
				}
			}
			s.mu.Unlock()
		}
	}
}
