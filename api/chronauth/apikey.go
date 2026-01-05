package chronauth

import (
	"context"
	"crypto"
	"fmt"
	"strconv"
	"time"

	"github.com/Emyrk/chronicle/api/chronauth/authkeys"
	"github.com/Emyrk/chronicle/database"
	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type Claims struct {
	jwt.Claims

	Provider string `json:"provider,omitempty"`
}

type SessionOptions struct {
	SecretPEM []byte
	Registry  prometheus.Registerer
}

type Sessions struct {
	Signer    jose.Signer
	Validator crypto.PublicKey
	Issuer    string

	createSessionGauge   prometheus.Gauge
	validateSessionGauge *prometheus.GaugeVec
}

func NewSessions(opts SessionOptions) (*Sessions, error) {
	secretKey, err := authkeys.ParsePrivateKey(opts.SecretPEM)
	if err != nil {
		return nil, fmt.Errorf("parse private key: %w", err)
	}

	if opts.Registry == nil {
		opts.Registry = prometheus.NewRegistry()
	}

	// Instantiate a signer using RSASSA-PSS (SHA512) with the given private key.
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.PS512, Key: secretKey}, nil)
	if err != nil {
		return nil, fmt.Errorf("create signer: %w", err)
	}

	factory := promauto.With(opts.Registry)
	return &Sessions{
		Signer:    signer,
		Validator: secretKey.Public(),
		Issuer:    "Chronicle", // TODO: make it a url?
		createSessionGauge: factory.NewGauge(prometheus.GaugeOpts{
			Namespace: "chronicle",
			Subsystem: "api_auth",
			Name:      "create_session_count",
			Help:      "Count of sessions created",
		}),
		validateSessionGauge: factory.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: "chronicle",
			Subsystem: "api_auth",
			Name:      "validate_session_count",
			Help:      "Count of sessions validated",
		}, []string{"valid"}),
	}, nil
}

// ValidateSession returns the user ID && session id if the session is valid
func (a *Sessions) ValidateSession(payload string) (uuid.UUID, uuid.UUID, error) {
	valid := false
	defer func() {
		a.validateSessionGauge.WithLabelValues(strconv.FormatBool(valid)).Inc()
	}()

	token, err := jwt.ParseSigned(payload, []jose.SignatureAlgorithm{
		jose.PS512,
	})
	if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("parse token: %w", err)
	}

	claims := Claims{}
	err = token.Claims(a.Validator, &claims)
	if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("parse claims: %w", err)
	}

	err = claims.Validate(jwt.Expected{
		Issuer: a.Issuer,
		Time:   time.Now(),
	})
	if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("validate claims: %w", err)
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("parse subject: %w", err)
	}

	sessionID, err := uuid.Parse(claims.ID)
	if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("parse subject: %w", err)
	}

	valid = true
	return userID, sessionID, nil
}

func (a *Sessions) CreateSession(ctx context.Context, session database.UserAuthSession) (string, error) {
	c := &Claims{
		Claims: jwt.Claims{
			Issuer:    a.Issuer,
			Subject:   session.UserAuthID.String(),
			Audience:  []string{a.Issuer},
			Expiry:    jwt.NewNumericDate(session.ExpiresAt.Time),
			NotBefore: jwt.NewNumericDate(session.CreatedAt.Time.Add(time.Minute * -1)),
			IssuedAt:  jwt.NewNumericDate(session.CreatedAt.Time),
			ID:        session.ID.String(),
		},
	}
	payload, err := jwt.Signed(a.Signer).Claims(c).Serialize()
	if err != nil {
		return "", fmt.Errorf("sign session: %w", err)
	}
	a.createSessionGauge.Inc()

	return payload, nil
}
