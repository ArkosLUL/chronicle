package database

import (
	"context"

	"github.com/google/uuid"
)

type withActorContextKey struct{}

func WithActor(ctx context.Context, uid uuid.UUID) context.Context {
	return context.WithValue(ctx, withActorContextKey{}, uid)
}

func Actor(ctx context.Context) uuid.UUID {
	v := ctx.Value(withActorContextKey{})
	if v == nil {
		return uuid.Nil
	}
	return v.(uuid.UUID)
}
