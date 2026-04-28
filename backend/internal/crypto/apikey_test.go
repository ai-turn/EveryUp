package crypto

import (
	"encoding/hex"
	"strings"
	"testing"
)

func TestGenerateApiKeyUsesEveryUpPrefix(t *testing.T) {
	key := GenerateApiKey()

	if !strings.HasPrefix(key, ApiKeyPrefix) {
		t.Fatalf("GenerateApiKey() prefix = %q, want %q", key[:len(ApiKeyPrefix)], ApiKeyPrefix)
	}

	hexPart := strings.TrimPrefix(key, ApiKeyPrefix)
	if len(hexPart) != 64 {
		t.Fatalf("GenerateApiKey() hex length = %d, want 64", len(hexPart))
	}
	if _, err := hex.DecodeString(hexPart); err != nil {
		t.Fatalf("GenerateApiKey() hex part is invalid: %v", err)
	}
}

func TestMaskApiKey(t *testing.T) {
	key := ApiKeyPrefix + "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

	masked := MaskApiKey(key)

	if masked != "everyup_12.....cdef" {
		t.Fatalf("MaskApiKey() = %q, want %q", masked, "everyup_12.....cdef")
	}
}

func TestMaskApiKeyLeavesShortKeysUnchanged(t *testing.T) {
	key := "short_key"

	if got := MaskApiKey(key); got != key {
		t.Fatalf("MaskApiKey() = %q, want %q", got, key)
	}
}
