package handlers

import (
	"encoding/json"
	"testing"
)

func TestMaskHeaders(t *testing.T) {
	t.Run("masks matching header case-insensitively", func(t *testing.T) {
		h := map[string]string{
			"Authorization": "Bearer xyz",
			"Content-Type":  "application/json",
		}
		result := MaskHeaders(h, []string{"authorization"})
		if result["Authorization"] != "***" {
			t.Errorf("Authorization = %q, want %q", result["Authorization"], "***")
		}
		if result["Content-Type"] != "application/json" {
			t.Errorf("Content-Type = %q, want %q", result["Content-Type"], "application/json")
		}
	})

	t.Run("case-insensitive key match for X-API-Key", func(t *testing.T) {
		h := map[string]string{
			"X-API-Key": "secret",
		}
		result := MaskHeaders(h, []string{"x-api-key"})
		if result["X-API-Key"] != "***" {
			t.Errorf("X-API-Key = %q, want %q", result["X-API-Key"], "***")
		}
	})

	t.Run("nil map returns nil without panic", func(t *testing.T) {
		result := MaskHeaders(nil, []string{"authorization"})
		if result != nil {
			t.Errorf("expected nil, got %v", result)
		}
	})

	t.Run("empty masked list returns copy unchanged", func(t *testing.T) {
		h := map[string]string{
			"Authorization": "Bearer xyz",
			"Content-Type":  "application/json",
		}
		result := MaskHeaders(h, []string{})
		if result["Authorization"] != "Bearer xyz" {
			t.Errorf("Authorization = %q, want %q", result["Authorization"], "Bearer xyz")
		}
		if result["Content-Type"] != "application/json" {
			t.Errorf("Content-Type = %q, want %q", result["Content-Type"], "application/json")
		}
		// Ensure it is a copy, not the same map
		result["Authorization"] = "changed"
		if h["Authorization"] == "changed" {
			t.Error("MaskHeaders modified original map")
		}
	})
}

func TestMaskJSONBody(t *testing.T) {
	t.Run("masks matching field, leaves others unchanged", func(t *testing.T) {
		body := `{"user":"bob","password":"s3cret"}`
		result := MaskJSONBody(body, []string{"password"})
		var m map[string]interface{}
		if err := json.Unmarshal([]byte(result), &m); err != nil {
			t.Fatalf("result is not valid JSON: %v", err)
		}
		if m["password"] != "***" {
			t.Errorf("password = %v, want %q", m["password"], "***")
		}
		if m["user"] != "bob" {
			t.Errorf("user = %v, want %q", m["user"], "bob")
		}
	})

	t.Run("masks nested object field", func(t *testing.T) {
		body := `{"nested":{"token":"t","name":"n"}}`
		result := MaskJSONBody(body, []string{"token"})
		var m map[string]interface{}
		if err := json.Unmarshal([]byte(result), &m); err != nil {
			t.Fatalf("result is not valid JSON: %v", err)
		}
		nested, ok := m["nested"].(map[string]interface{})
		if !ok {
			t.Fatal("nested is not an object")
		}
		if nested["token"] != "***" {
			t.Errorf("nested.token = %v, want %q", nested["token"], "***")
		}
		if nested["name"] != "n" {
			t.Errorf("nested.name = %v, want %q", nested["name"], "n")
		}
	})

	t.Run("non-JSON body returned unchanged", func(t *testing.T) {
		body := "plain text"
		result := MaskJSONBody(body, []string{"password"})
		if result != body {
			t.Errorf("result = %q, want %q", result, body)
		}
	})

	t.Run("empty body returned unchanged", func(t *testing.T) {
		result := MaskJSONBody("", []string{"password"})
		if result != "" {
			t.Errorf("result = %q, want %q", result, "")
		}
	})

	t.Run("array body returned unchanged", func(t *testing.T) {
		body := "[1,2,3]"
		result := MaskJSONBody(body, []string{"password"})
		if result != body {
			t.Errorf("result = %q, want %q", result, body)
		}
	})

	t.Run("empty fields list returns body unchanged", func(t *testing.T) {
		body := `{"user":"bob","password":"s3cret"}`
		result := MaskJSONBody(body, []string{})
		if result != body {
			t.Errorf("result = %q, want %q", result, body)
		}
	})
}

func TestTruncateBody(t *testing.T) {
	t.Run("body shorter than maxBytes returned as-is", func(t *testing.T) {
		body := "hello"
		truncated, size := TruncateBody(body, 10)
		if truncated != body {
			t.Errorf("truncated = %q, want %q", truncated, body)
		}
		if size != 5 {
			t.Errorf("originalSize = %d, want 5", size)
		}
	})

	t.Run("body longer than maxBytes is truncated with suffix", func(t *testing.T) {
		body := "hello world" // 11 chars
		truncated, size := TruncateBody(body, 5)
		want := "hello\u2026[truncated, 11 bytes]"
		if truncated != want {
			t.Errorf("truncated = %q, want %q", truncated, want)
		}
		if size != 11 {
			t.Errorf("originalSize = %d, want 11", size)
		}
	})

	t.Run("maxBytes 0 returns empty string with originalSize", func(t *testing.T) {
		body := "hello"
		truncated, size := TruncateBody(body, 0)
		if truncated != "" {
			t.Errorf("truncated = %q, want %q", truncated, "")
		}
		if size != 5 {
			t.Errorf("originalSize = %d, want 5", size)
		}
	})

	t.Run("empty body returns empty string with size 0", func(t *testing.T) {
		truncated, size := TruncateBody("", 10)
		if truncated != "" {
			t.Errorf("truncated = %q, want %q", truncated, "")
		}
		if size != 0 {
			t.Errorf("originalSize = %d, want 0", size)
		}
	})
}
