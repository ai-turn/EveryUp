package handlers

import (
	"encoding/json"
	"fmt"
	"strings"
)

// MaskHeaders returns a copy of h with values replaced by "***" for any key
// that case-insensitively matches an entry in masked.
func MaskHeaders(h map[string]string, masked []string) map[string]string {
	if h == nil {
		return nil
	}

	// Build a lowercase set of keys to mask for O(1) lookup.
	maskSet := make(map[string]struct{}, len(masked))
	for _, k := range masked {
		maskSet[strings.ToLower(k)] = struct{}{}
	}

	out := make(map[string]string, len(h))
	for k, v := range h {
		if _, shouldMask := maskSet[strings.ToLower(k)]; shouldMask {
			out[k] = "***"
		} else {
			out[k] = v
		}
	}
	return out
}

// MaskJSONBody parses body as a JSON object and replaces string/number/bool
// values at keys that case-insensitively match any entry in fields with "***".
// Recursion: applies to nested objects too.
// If body is empty or not a JSON object → return body unchanged.
func MaskJSONBody(body string, fields []string) string {
	if body == "" || len(fields) == 0 {
		return body
	}

	var root interface{}
	if err := json.Unmarshal([]byte(body), &root); err != nil {
		// Not valid JSON — return unchanged.
		return body
	}

	obj, ok := root.(map[string]interface{})
	if !ok {
		// JSON array or scalar — return unchanged.
		return body
	}

	// Build lowercase set of field names to mask.
	maskSet := make(map[string]struct{}, len(fields))
	for _, f := range fields {
		maskSet[strings.ToLower(f)] = struct{}{}
	}

	maskObject(obj, maskSet)

	out, err := json.Marshal(obj)
	if err != nil {
		return body
	}
	return string(out)
}

// maskObject recursively masks matching keys in a JSON object map.
func maskObject(obj map[string]interface{}, maskSet map[string]struct{}) {
	for k, v := range obj {
		if _, shouldMask := maskSet[strings.ToLower(k)]; shouldMask {
			switch v.(type) {
			case string, float64, bool:
				obj[k] = "***"
			}
		} else {
			// Recurse into nested objects.
			if nested, ok := v.(map[string]interface{}); ok {
				maskObject(nested, maskSet)
			}
		}
	}
}

// TruncateBody returns (truncated, originalSize).
// If len(body) <= maxBytes → return (body, len(body)).
// If len(body) > maxBytes → return body[:maxBytes] + "…[truncated, N bytes]", len(body).
// If maxBytes <= 0 → return ("", len(body)).
func TruncateBody(body string, maxBytes int) (string, int) {
	originalSize := len(body)
	if maxBytes <= 0 {
		return "", originalSize
	}
	if originalSize <= maxBytes {
		return body, originalSize
	}
	return body[:maxBytes] + fmt.Sprintf("\u2026[truncated, %d bytes]", originalSize), originalSize
}
