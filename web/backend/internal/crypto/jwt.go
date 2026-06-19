package crypto

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"io"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret []byte

// InitJWTSecret loads or auto-generates the JWT signing secret from app_settings.
// Follows the same pattern as InitFromDB (encryption key).
func InitJWTSecret(db *sql.DB) error {
	const keyName = "jwt_secret"

	var keyHex string
	err := db.QueryRow(`SELECT value FROM app_settings WHERE key = ?`, keyName).Scan(&keyHex)
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("failed to load JWT secret: %w", err)
	}

	if keyHex == "" {
		key := make([]byte, 64) // 512-bit for HMAC-SHA256
		if _, err := io.ReadFull(rand.Reader, key); err != nil {
			return fmt.Errorf("failed to generate JWT secret: %w", err)
		}
		keyHex = hex.EncodeToString(key)
		if _, err := db.Exec(
			`INSERT INTO app_settings (key, value) VALUES (?, ?)`, keyName, keyHex,
		); err != nil {
			return fmt.Errorf("failed to persist JWT secret: %w", err)
		}
	}

	key, err := hex.DecodeString(keyHex)
	if err != nil {
		return fmt.Errorf("invalid JWT secret in DB: %w", err)
	}
	jwtSecret = key
	return nil
}

// RotateSecret generates a new JWT signing secret, persists it, and updates the in-memory key.
// All existing tokens signed with the old secret become immediately invalid.
func RotateSecret(db *sql.DB) error {
	key := make([]byte, 64)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return fmt.Errorf("failed to generate new JWT secret: %w", err)
	}
	keyHex := hex.EncodeToString(key)
	if _, err := db.Exec(
		`INSERT INTO app_settings (key, value) VALUES ('jwt_secret', ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		keyHex,
	); err != nil {
		return fmt.Errorf("failed to persist new JWT secret: %w", err)
	}
	jwtSecret = key
	return nil
}

// UserClaims holds the JWT payload for an authenticated user.
type UserClaims struct {
	UserID   int64  `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// SignToken creates a signed JWT for a user. Expires in 7 days.
func SignToken(claims UserClaims) (string, error) {
	claims.RegisteredClaims = jwt.RegisteredClaims{
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
		Issuer:    "everyup",
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString(jwtSecret)
}

// VerifyToken parses and validates a JWT. Returns claims if valid.
func VerifyToken(tokenStr string) (*UserClaims, error) {
	claims := &UserClaims{}
	t, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return jwtSecret, nil
	})
	if err != nil || !t.Valid {
		return nil, fmt.Errorf("invalid token: %w", err)
	}
	return claims, nil
}
