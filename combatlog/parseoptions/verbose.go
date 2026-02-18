package parseoptions

import "context"

type verboseKey struct{}

func WithVerbose(ctx context.Context, verbose bool) context.Context {
	return context.WithValue(ctx, verboseKey{}, verbose)
}

func IsVerbose(ctx context.Context) bool {
	if ctx == nil {
		return false
	}
	verbose, ok := ctx.Value(verboseKey{}).(bool)
	return ok && verbose
}
