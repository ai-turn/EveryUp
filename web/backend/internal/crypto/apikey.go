package crypto

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
)

const ApiKeyPrefix = "everyup_"

// GenerateApiKey generates a cryptographically secure API key.
// Format: everyup_ + 64 hex chars (256 bits of entropy).
func GenerateApiKey() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		// rand.Read should never fail on any supported OS.
		panic("crypto/rand unavailable: " + err.Error())
	}
	return ApiKeyPrefix + hex.EncodeToString(b)
}

// MaskApiKey returns a masked version of the plaintext API key.
// Shows the first 10 and last 4 characters.
// Example: "everyup_ab.....5f9a"
func MaskApiKey(plainKey string) string {
	if len(plainKey) <= 14 {
		return plainKey
	}
	return plainKey[:10] + "....." + plainKey[len(plainKey)-4:]
}

// HashApiKey returns the SHA-256 hex digest of an API key.
// Store this hash in the database, never the plaintext key.
// Lookup: hash the user-supplied key and compare with stored hash.
func HashApiKey(apiKey string) string {
	sum := sha256.Sum256([]byte(apiKey))
	return hex.EncodeToString(sum[:])
}
