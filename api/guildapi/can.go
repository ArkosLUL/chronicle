package guildapi

import (
	"net/http"

	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/api/httpmw"
	"github.com/Emyrk/chronicle/database/authz"
	"github.com/Emyrk/chronicle/database/authz/policy"
	"github.com/authzed/gochugaru/rel"
)

func Can(zed *authz.Authz, getCheck func(on *policy.ObjGuild) func(sub *policy.ObjUser) rel.Relationship) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			actor, ok := authz.ActorFromContext(ctx)
			if !ok {
				httpapi.Forbidden(w, nil)
				return
			}

			guild := httpmw.Guild(ctx)
			zg := policy.New().Guild(guild.ID)
			check := getCheck(zg)

			can, err := zed.CheckOne(ctx, nil, check(actor))
			if err != nil {
				httpapi.InternalServerError(w, err)
				return
			}
			if !can {
				httpapi.Forbidden(w, nil)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
