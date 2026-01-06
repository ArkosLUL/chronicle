package claims

import (
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/google/uuid"
)

type Claims struct {
	Issuer    string           `json:"iss,omitempty"`
	Subject   uuid.UUID        `json:"sub,omitempty"`
	Audience  jwt.Audience     `json:"aud,omitempty"`
	Expiry    *jwt.NumericDate `json:"exp,omitempty"`
	NotBefore *jwt.NumericDate `json:"nbf,omitempty"`
	IssuedAt  *jwt.NumericDate `json:"iat,omitempty"`
	ID        uuid.UUID        `json:"jti,omitempty"`

	// Extra custom claims
	Provider    string           `json:"provider,omitempty"`
	OAuthExpire *jwt.NumericDate `json:"oexp,omitempty"`
	Refreshable bool             `json:"refreshable,omitempty"`
}
