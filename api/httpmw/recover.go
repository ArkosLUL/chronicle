package httpmw

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"runtime/debug"

	"github.com/Emyrk/chronicle/api/httpapi"
)

func Recover(log *slog.Logger) func(h http.Handler) http.Handler {
	return func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				r := recover()

				// Reverse proxying (among other things) may panic with
				// http.ErrAbortHandler when the request is aborted. It's not a
				// real panic so we shouldn't log them.
				//
				//nolint:errorlint // this is how the stdlib does the check
				if r != nil && r != http.ErrAbortHandler {
					log.Warn(
						"panic serving http request (recovered)",
						slog.Any("panic", r),
						slog.String("stack", string(debug.Stack())),
					)

					_, _ = fmt.Fprintf(os.Stderr, string(debug.Stack()))
					httpapi.InternalServerError(w, errors.New("a panic occured"))
					return
				}
			}()

			h.ServeHTTP(w, r)
		})
	}
}
