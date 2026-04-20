package chronauth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/authz"
	"github.com/Emyrk/chronicle/database/authz/policy"
	"github.com/authzed/gochugaru/rel"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const (
	PasswordProvider = "password"

	// passwordSessionLifetime is the JWT lifetime for password-based sessions.
	// These sessions are not refreshable via OAuth, so use a longer lifetime.
	passwordSessionLifetime = 30 * 24 * time.Hour // 30 days

	minPasswordLength = 8
	maxPasswordLength = 128

	registerRateLimit = 5 * time.Minute
	loginRateLimit    = 5 * time.Second
)

type PasswordRegisterRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type PasswordLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Service) PasswordRegister(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Rate limit: one registration per IP per 5 minutes
	ip := extractIP(r)
	if !s.checkRegisterRateLimit(ip) {
		httpapi.Write(ctx, w, http.StatusTooManyRequests, map[string]string{
			"message": "Please wait before registering again.",
		})
		return
	}

	var req PasswordRegisterRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	if err := validateEmail(req.Email); err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, map[string]string{
			"message": "Invalid email address.",
			"detail":  err.Error(),
		})
		return
	}

	if err := validatePassword(req.Password); err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, map[string]string{
			"message": "Invalid password.",
			"detail":  err.Error(),
		})
		return
	}

	if req.Username == "" {
		httpapi.Write(ctx, w, http.StatusBadRequest, map[string]string{
			"message": "Username is required.",
		})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusInternalServerError, map[string]string{
			"message": "Internal error.",
		})
		return
	}

	now := time.Now()
	var session database.UserAuthSession

	err = s.Zed.InTx(func(tx *authz.AuthzTX) error {
		// Check if this email is already registered with the password provider
		_, err := tx.GetUserAuthByLinkedID(ctx, database.GetUserAuthByLinkedIDParams{
			LinkedID: req.Email,
			Provider: PasswordProvider,
		})
		if err == nil {
			return fmt.Errorf("email already registered")
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return err
		}

		// Check if a user with this email already exists (e.g., from Discord OAuth).
		// If so, link the password provider to the existing user.
		existingUser, err := tx.GetUserByEmail(ctx, req.Email)
		var userID uuid.UUID
		if err == nil {
			userID = existingUser.ID
		} else if errors.Is(err, sql.ErrNoRows) {
			// Create new user
			userRow, err := tx.InsertUser(ctx, database.InsertUserParams{
				ID:        uuid.New(),
				Username:  req.Username,
				Email:     req.Email,
				CreatedAt: database.Timestamptz(now),
				UpdatedAt: database.Timestamptz(now),
			})
			if err != nil {
				return fmt.Errorf("insert user: %w", err)
			}
			userID = userRow.ID
		} else {
			return fmt.Errorf("check existing user: %w", err)
		}

		// Create auth link
		linked, err := tx.InsertUserAuth(ctx, database.InsertUserAuthParams{
			ID:        uuid.New(),
			LinkedID:  req.Email,
			UserID:    userID,
			Provider:  PasswordProvider,
			CreatedAt: database.Timestamptz(now),
			UpdatedAt: database.Timestamptz(now),
		})
		if err != nil {
			return fmt.Errorf("insert user auth: %w", err)
		}

		// Store password hash
		_, err = tx.InsertUserPassword(ctx, database.InsertUserPasswordParams{
			UserAuthID:   linked.ID,
			PasswordHash: string(hash),
			UpdatedAt:    database.Timestamptz(now),
		})
		if err != nil {
			return fmt.Errorf("insert user password: %w", err)
		}

		// Sync roles
		err = s.syncPasswordUser(ctx, tx, userID)
		if err != nil {
			return fmt.Errorf("sync password user: %w", err)
		}

		// Create session
		session, err = tx.InsertUserAuthSession(ctx, database.InsertUserAuthSessionParams{
			ID:                uuid.New(),
			JwtID:             uuid.New(),
			UserID:            userID,
			UserAuthID:        linked.ID,
			AccessToken:       "",
			AccessTokenSecret: "",
			RefreshToken:      "",
			ExpiresAt:         database.Timestamptz(now.Add(passwordSessionLifetime)),
			CreatedAt:         database.Timestamptz(now),
			UpdatedAt:         database.Timestamptz(now),
		})
		if err != nil {
			return fmt.Errorf("insert session: %w", err)
		}

		return nil
	}, nil)
	if err != nil {
		if err.Error() == "email already registered" {
			httpapi.Write(ctx, w, http.StatusConflict, map[string]string{
				"message": "An account with this email already exists.",
			})
			return
		}
		s.logger.Error("password register failed",
			slog.String("error", err.Error()),
		)
		httpapi.Write(ctx, w, http.StatusInternalServerError, map[string]string{
			"message": "Internal error.",
		})
		return
	}

	err = s.SetSessionCookie(w, r, PasswordProvider, session)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusInternalServerError, map[string]string{
			"message": "Failed to create session.",
		})
		return
	}

	s.logger.Info("new password user registered",
		slog.String("email", req.Email),
		slog.String("username", req.Username),
		slog.String("user_id", session.UserID.String()),
	)

	httpapi.Write(ctx, w, http.StatusCreated, map[string]string{
		"message": "Account created.",
	})
}

func (s *Service) PasswordLogin(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	ip := extractIP(r)
	if !s.checkLoginRateLimit(ip) {
		httpapi.Write(ctx, w, http.StatusTooManyRequests, map[string]string{
			"message": "Too many login attempts. Please wait a few seconds.",
		})
		return
	}

	var req PasswordLoginRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	// Look up auth link for this email + password provider
	linked, err := s.Zed.GetUserAuthByLinkedID(ctx, database.GetUserAuthByLinkedIDParams{
		LinkedID: req.Email,
		Provider: PasswordProvider,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpapi.Write(ctx, w, http.StatusUnauthorized, map[string]string{
				"message": "Invalid email or password.",
			})
			return
		}
		httpapi.Write(ctx, w, http.StatusInternalServerError, map[string]string{
			"message": "Internal error.",
		})
		return
	}

	// Get password hash
	pw, err := s.Zed.GetUserPasswordByAuthID(ctx, linked.ID)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusInternalServerError, map[string]string{
			"message": "Internal error.",
		})
		return
	}

	// Compare password
	err = bcrypt.CompareHashAndPassword([]byte(pw.PasswordHash), []byte(req.Password))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusUnauthorized, map[string]string{
			"message": "Invalid email or password.",
		})
		return
	}

	// Create session
	now := time.Now()
	session, err := s.Zed.InsertUserAuthSession(ctx, database.InsertUserAuthSessionParams{
		ID:                uuid.New(),
		JwtID:             uuid.New(),
		UserID:            linked.UserID,
		UserAuthID:        linked.ID,
		AccessToken:       "",
		AccessTokenSecret: "",
		RefreshToken:      "",
		ExpiresAt:         database.Timestamptz(now.Add(passwordSessionLifetime)),
		CreatedAt:         database.Timestamptz(now),
		UpdatedAt:         database.Timestamptz(now),
	})
	if err != nil {
		httpapi.Write(ctx, w, http.StatusInternalServerError, map[string]string{
			"message": "Internal error.",
		})
		return
	}

	// Sync roles on each login
	err = s.syncPasswordUser(ctx, s.Zed, linked.UserID)
	if err != nil {
		s.logger.Error("sync password user on login",
			slog.String("error", err.Error()),
			slog.String("user_id", linked.UserID.String()),
		)
		// Non-fatal: don't block login for role sync failure
	}

	err = s.SetSessionCookie(w, r, PasswordProvider, session)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusInternalServerError, map[string]string{
			"message": "Failed to create session.",
		})
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, map[string]string{
		"message": "Login successful.",
	})
}

func validateEmail(email string) error {
	if email == "" {
		return fmt.Errorf("email is required")
	}
	_, err := mail.ParseAddress(email)
	if err != nil {
		return fmt.Errorf("invalid email format")
	}
	return nil
}

func validatePassword(password string) error {
	if len(password) < minPasswordLength {
		return fmt.Errorf("password must be at least %d characters", minPasswordLength)
	}
	if len(password) > maxPasswordLength {
		return fmt.Errorf("password must be at most %d characters", maxPasswordLength)
	}
	return nil
}

func (s *Service) checkLoginRateLimit(ip string) bool {
	s.loginMu.Lock()
	defer s.loginMu.Unlock()

	now := time.Now()
	for k, v := range s.loginAttempts {
		if now.Sub(v) > loginRateLimit {
			delete(s.loginAttempts, k)
		}
	}

	if last, ok := s.loginAttempts[ip]; ok && now.Sub(last) < loginRateLimit {
		return false
	}
	s.loginAttempts[ip] = now
	return true
}

func (s *Service) checkRegisterRateLimit(ip string) bool {
	s.registerMu.Lock()
	defer s.registerMu.Unlock()

	now := time.Now()
	// Lazy cleanup of expired entries
	for k, v := range s.registerAttempts {
		if now.Sub(v) > registerRateLimit {
			delete(s.registerAttempts, k)
		}
	}

	if last, ok := s.registerAttempts[ip]; ok && now.Sub(last) < registerRateLimit {
		return false
	}
	s.registerAttempts[ip] = now
	return true
}

// syncPasswordUser assigns the base Chronicle_member role to a password-auth user.
// Similar to SyncDiscordUser but without Discord-specific role mapping.
func (s *Service) syncPasswordUser(ctx context.Context, zed authz.DatabaseAuthorizer, userID uuid.UUID) error {
	b := policy.New()
	gChron := b.GlobalChronicle()
	usr := b.User(userID)

	// Clear existing roles for this user in the global namespace
	f := rel.NewFilter(gChron.Object().Typ, gChron.Object().ID, "")
	f.WithSubjectFilter(usr.Object().Typ, usr.Object().ID, "")
	err := zed.Delete(ctx, rel.NewPreconditionedFilter(f))
	if err != nil {
		return fmt.Errorf("zed.Delete: %w", err)
	}

	gChron.Chronicle_member(usr)
	_, err = zed.Write(ctx, *b.Txn())
	if err != nil {
		return fmt.Errorf("zed.Write: %w", err)
	}

	return nil
}

func extractIP(r *http.Request) string {
	// Check X-Forwarded-For first (Railway / reverse proxies)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if idx := strings.IndexByte(xff, ','); idx != -1 {
			return strings.TrimSpace(xff[:idx])
		}
		return strings.TrimSpace(xff)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
