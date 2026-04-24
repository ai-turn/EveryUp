package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
)

var masterKey []byte

// InitFromDB loads the master encryption key with the following priority:
//  1. EVERYUP_ENCRYPTION_KEY environment variable (recommended for production)
//  2. Key file at <db-dir>/.encryption_key (auto-generated on first run)
//  3. Fallback to DB app_settings table (legacy, for backward compatibility)
//
// New installations will store the key in a file separate from the database,
// so that a database leak alone does not compromise encrypted data.
func InitFromDB(db *sql.DB) error {
	const keyName = "encryption_key"

	// Priority 1: Environment variable
	if envKey := os.Getenv("EVERYUP_ENCRYPTION_KEY"); envKey != "" {
		key, err := hex.DecodeString(strings.TrimSpace(envKey))
		if err != nil || len(key) != 32 {
			return fmt.Errorf("EVERYUP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)")
		}
		masterKey = key
		log.Println("Encryption key loaded from environment variable")
		return nil
	}

	// Priority 2: Key file (separate from database)
	keyFilePath := resolveKeyFilePath()
	if data, err := os.ReadFile(keyFilePath); err == nil {
		key, err := hex.DecodeString(strings.TrimSpace(string(data)))
		if err == nil && len(key) == 32 {
			masterKey = key
			log.Printf("Encryption key loaded from file: %s", keyFilePath)
			return nil
		}
	}

	// Priority 3: DB fallback (legacy / migration path)
	var keyHex string
	err := db.QueryRow(`SELECT value FROM app_settings WHERE key = ?`, keyName).Scan(&keyHex)
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("failed to load encryption key: %w", err)
	}

	if keyHex != "" {
		// Existing key in DB — migrate to file and keep working
		key, err := hex.DecodeString(keyHex)
		if err != nil {
			return fmt.Errorf("invalid encryption key in DB: %w", err)
		}
		masterKey = key
		// Migrate: write to file so future startups use file instead of DB
		if writeErr := writeKeyFile(keyFilePath, keyHex); writeErr != nil {
			log.Printf("Warning: could not migrate encryption key to file: %v", writeErr)
		} else {
			log.Printf("Encryption key migrated from DB to file: %s", keyFilePath)
		}
		return nil
	}

	// First run — generate new key and store in file (not DB)
	key := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return fmt.Errorf("failed to generate encryption key: %w", err)
	}
	keyHex = hex.EncodeToString(key)

	if err := writeKeyFile(keyFilePath, keyHex); err != nil {
		// File write failed — fall back to DB storage
		log.Printf("Warning: could not write key file, falling back to DB: %v", err)
		if _, dbErr := db.Exec(
			`INSERT INTO app_settings (key, value) VALUES (?, ?)`, keyName, keyHex,
		); dbErr != nil {
			return fmt.Errorf("failed to persist encryption key: %w", dbErr)
		}
	} else {
		log.Printf("Encryption key generated and saved to file: %s", keyFilePath)
	}

	masterKey = key
	return nil
}

// resolveKeyFilePath returns the path for the encryption key file,
// co-located with the database directory.
func resolveKeyFilePath() string {
	dbPath := os.Getenv("EVERYUP_DATABASE_PATH")
	if dbPath == "" {
		dbPath = "./data/monitoring.db"
	}
	return filepath.Join(filepath.Dir(dbPath), ".encryption_key")
}

// writeKeyFile writes the hex-encoded key to a file with restricted permissions.
func writeKeyFile(path, keyHex string) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(keyHex), 0600)
}

// Encrypt encrypts plaintext using AES-256-GCM.
// Returns hex-encoded ciphertext.
func Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return plaintext, nil
	}

	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return "", fmt.Errorf("cipher creation failed: %w", err)
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("GCM creation failed: %w", err)
	}

	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("nonce generation failed: %w", err)
	}

	ciphertext := aesGCM.Seal(nonce, nonce, []byte(plaintext), nil)
	return hex.EncodeToString(ciphertext), nil
}

// Decrypt decrypts hex-encoded AES-256-GCM ciphertext.
// Falls back to returning the input as-is for pre-encryption plaintext data.
func Decrypt(ciphertextHex string) (string, error) {
	if ciphertextHex == "" {
		return ciphertextHex, nil
	}

	ciphertext, err := hex.DecodeString(ciphertextHex)
	if err != nil {
		// Not hex — pre-encryption plaintext, return as-is
		return ciphertextHex, nil
	}

	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return "", fmt.Errorf("cipher creation failed: %w", err)
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("GCM creation failed: %w", err)
	}

	nonceSize := aesGCM.NonceSize()
	if len(ciphertext) < nonceSize {
		// Too short to be valid ciphertext — return as-is
		return ciphertextHex, nil
	}

	nonce, ciphertextBytes := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := aesGCM.Open(nil, nonce, ciphertextBytes, nil)
	if err != nil {
		// Decryption failed — data was stored before encryption was introduced
		return ciphertextHex, errors.New("decryption failed, data may not be encrypted")
	}

	return string(plaintext), nil
}
