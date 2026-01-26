package chronicle

import (
	"context"
	"net/http"

	"github.com/Emyrk/chronicle/api/chronicleproto"
	"github.com/Emyrk/chronicle/api/chronicleproto/chronicleprotoconnect"
)

var _ chronicleprotoconnect.ChronicleServiceHandler = (*Chronicle)(nil)

func (c *Chronicle) ChronicleGRPCHandler() (string, http.Handler) {
	return chronicleprotoconnect.NewChronicleServiceHandler(c)
}

func (c *Chronicle) Damage(ctx context.Context, request *chronicleproto.InstanceRequest) (*chronicleproto.DamageReport, error) {
	//TODO implement me
	panic("implement me")
}
