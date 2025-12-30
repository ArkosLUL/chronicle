package chronauth

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/Emyrk/chronicle/database"
	"github.com/go-pkgz/auth/v2/token"
)

type Persister struct {
	appCtx context.Context
	db     database.Store
	logger *slog.Logger
}

func (p *Persister) Update(claims token.Claims) token.Claims {
	fmt.Println("update", claims)
	//ctx := p.appCtx

	//_, err := p.db.InsertUser(ctx, database.InsertUserParams{
	//	ID:       uuid.New(),
	//	Username: claims.User.Name,
	//})
	//if err != nil {
	//	p.logger.Error("insert new user", slog.String("error", err.Error()))
	//}

	return claims
}

func (p *Persister) Validate(token string, claims token.Claims) bool {
	fmt.Println("valid", claims)
	return true
}
