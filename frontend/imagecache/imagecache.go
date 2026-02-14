package imagecache

import (
	"embed"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

//go:embed icons/*
var iconsFS embed.FS

// FS returns the embedded icons filesystem.
func FS() fs.FS {
	sub, err := fs.Sub(iconsFS, "icons")
	if err != nil {
		panic("imagecache: failed to get icons sub-filesystem: " + err.Error())
	}
	return sub
}

// Handler serves icons from a filesystem with optional alias resolution.
// Mount it at any route, e.g., r.Mount("/static/spellicon", imagecache.NewHandler(...))
type Handler struct {
	fs      fs.FS
	aliases map[string]string // e.g., {"sliceanddice": "inv_24"}
	maxAge  int               // Cache-Control max-age in seconds
}

// Option configures a Handler.
type Option func(*Handler)

// WithAliases sets the alias map (requested name → actual icon name).
// Keys and values should not include file extensions.
func WithAliases(aliases map[string]string) Option {
	return func(h *Handler) {
		h.aliases = aliases
	}
}

// WithMaxAge sets the Cache-Control max-age in seconds (default: 1 year).
func WithMaxAge(seconds int) Option {
	return func(h *Handler) {
		h.maxAge = seconds
	}
}

// NewHandler creates an icon handler using the provided filesystem.
// Use this if you want to supply your own fs.FS (e.g., for testing).
func NewHandler(filesystem fs.FS, opts ...Option) *Handler {
	h := &Handler{
		fs:      filesystem,
		aliases: make(map[string]string),
		maxAge:  int((time.Hour * 24 * 30).Seconds()), // 1 month
	}
	for _, opt := range opts {
		opt(h)
	}
	return h
}

// New creates an icon handler using the embedded icons filesystem.
func New(opts ...Option) *Handler {
	return NewHandler(FS(), opts...)
}

// ServeHTTP implements http.Handler.
// Expects the icon name as the URL path (e.g., "/sliceanddice.webp").
// When mounted with chi's Mount(), uses the route context to get the correct path.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Get requested filename from path
	// Use chi's RouteContext if available (handles Mount prefix stripping)
	urlPath := r.URL.Path
	if rctx := r.Context().Value(chi.RouteCtxKey); rctx != nil {
		if rc, ok := rctx.(*chi.Context); ok && rc.RoutePath != "" {
			urlPath = rc.RoutePath
		}
	}

	name := strings.TrimPrefix(urlPath, "/")
	if name == "" {
		http.NotFound(w, r)
		return
	}

	ext := path.Ext(name)
	baseName := strings.TrimSuffix(name, ext)

	// Resolve alias if exists, otherwise use name directly
	iconName := baseName
	if alias, ok := h.aliases[baseName]; ok {
		iconName = alias
	}

	// Open the icon file
	iconPath := iconName + ext
	f, err := h.fs.Open(iconPath)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		http.NotFound(w, r)
		return
	}

	// Set aggressive cache headers for Cloudflare and browsers
	w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d, immutable", h.maxAge))

	// Serve the content
	rs, ok := f.(io.ReadSeeker)
	if !ok {
		// Fallback for fs.FS implementations that don't support seeking
		w.Header().Set("Content-Type", mime.TypeByExtension(ext))
		_, _ = io.Copy(w, f)
		return
	}
	http.ServeContent(w, r, name, stat.ModTime(), rs)
}
