package parsectx

import (
	"context"

	"github.com/Emyrk/chronicle/database"
)

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

	return context.WithValue(ctx, "logType", &Context{
		Type: t,
	})
}

func FromContext(ctx context.Context) (*Context, bool) {
	if v := ctx.Value("logType"); v != nil {
		if c, ok := v.(*Context); ok {
			return c, ok
		}
	}
	return nil, false
}
