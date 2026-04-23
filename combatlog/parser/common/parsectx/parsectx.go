package parsectx

import (
	"context"

	"github.com/Emyrk/chronicle/database"
)

type logTypeKey struct{}

type Context struct {
	Type database.LogType
}

func Type(ctx context.Context) (database.LogType, bool) {
	c, ok := FromContext(ctx)
	if ok {
		return c.Type, true
	}
	return "", false
}

func WithType(ctx context.Context, t database.LogType) context.Context {
	c, ok := FromContext(ctx)
	if ok {
		c.Type = t
		return ctx
	}

	return context.WithValue(ctx, logTypeKey{}, &Context{
		Type: t,
	})
}

func FromContext(ctx context.Context) (*Context, bool) {
	if v := ctx.Value(logTypeKey{}); v != nil {
		if c, ok := v.(*Context); ok {
			return c, ok
		}
	}
	return nil, false
}
