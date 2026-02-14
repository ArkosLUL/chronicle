package imagecache_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"github.com/Emyrk/chronicle/frontend/imagecache"
	"github.com/stretchr/testify/require"
)

func TestHandler_ServeHTTP(t *testing.T) {
	t.Parallel()

	// Create a mock filesystem with test icons
	mockFS := fstest.MapFS{
		"spell_fire.png":   {Data: []byte("fire-icon-data")},
		"spell_frost.png":  {Data: []byte("frost-icon-data")},
		"inv_sword_01.png": {Data: []byte("sword-icon-data")},
	}

	tests := []struct {
		name           string
		path           string
		aliases        map[string]string
		expectedStatus int
		expectedBody   string
		checkCache     bool
	}{
		{
			name:           "direct file access",
			path:           "/spell_fire.png",
			aliases:        nil,
			expectedStatus: http.StatusOK,
			expectedBody:   "fire-icon-data",
			checkCache:     true,
		},
		{
			name:           "alias resolves to file",
			path:           "/fireball.png",
			aliases:        map[string]string{"fireball": "spell_fire"},
			expectedStatus: http.StatusOK,
			expectedBody:   "fire-icon-data",
			checkCache:     true,
		},
		{
			name:           "alias with different extension",
			path:           "/frostbolt.png",
			aliases:        map[string]string{"frostbolt": "spell_frost"},
			expectedStatus: http.StatusOK,
			expectedBody:   "frost-icon-data",
			checkCache:     true,
		},
		{
			name:           "unknown alias falls back to direct lookup",
			path:           "/inv_sword_01.png",
			aliases:        map[string]string{"fireball": "spell_fire"},
			expectedStatus: http.StatusOK,
			expectedBody:   "sword-icon-data",
			checkCache:     true,
		},
		{
			name:           "file not found",
			path:           "/nonexistent.png",
			aliases:        nil,
			expectedStatus: http.StatusNotFound,
			expectedBody:   "",
			checkCache:     false,
		},
		{
			name:           "alias points to nonexistent file",
			path:           "/badspell.png",
			aliases:        map[string]string{"badspell": "nonexistent"},
			expectedStatus: http.StatusNotFound,
			expectedBody:   "",
			checkCache:     false,
		},
		{
			name:           "empty path",
			path:           "/",
			aliases:        nil,
			expectedStatus: http.StatusNotFound,
			expectedBody:   "",
			checkCache:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			opts := []imagecache.Option{}
			if tt.aliases != nil {
				opts = append(opts, imagecache.WithAliases(tt.aliases))
			}

			handler := imagecache.NewHandler(mockFS, opts...)

			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			require.Equal(t, tt.expectedStatus, rec.Code)

			if tt.expectedBody != "" {
				body, _ := io.ReadAll(rec.Body)
				require.Equal(t, tt.expectedBody, string(body))
			}

			if tt.checkCache {
				cacheControl := rec.Header().Get("Cache-Control")
				require.Contains(t, cacheControl, "public")
				require.Contains(t, cacheControl, "max-age=31536000")
				require.Contains(t, cacheControl, "immutable")
			}
		})
	}
}

func TestHandler_WithMaxAge(t *testing.T) {
	t.Parallel()

	mockFS := fstest.MapFS{
		"test.png": {Data: []byte("test")},
	}

	handler := imagecache.NewHandler(mockFS, imagecache.WithMaxAge(3600))

	req := httptest.NewRequest(http.MethodGet, "/test.png", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Header().Get("Cache-Control"), "max-age=3600")
}
