package models_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

func TestDefaultApiCaptureConfig(t *testing.T) {
	cfg := models.DefaultApiCaptureConfig()

	if cfg.Mode != models.CaptureModeSampled {
		t.Errorf("Mode = %q, want %q", cfg.Mode, models.CaptureModeSampled)
	}
	if cfg.SampleRate != 10 {
		t.Errorf("SampleRate = %d, want 10", cfg.SampleRate)
	}
	if cfg.BodyMaxBytes != 8192 {
		t.Errorf("BodyMaxBytes = %d, want 8192", cfg.BodyMaxBytes)
	}

	if len(cfg.MaskedHeaders) != 5 {
		t.Errorf("len(MaskedHeaders) = %d, want 5", len(cfg.MaskedHeaders))
	}
	hasAuthorization := false
	hasCookie := false
	for _, h := range cfg.MaskedHeaders {
		if h == "authorization" {
			hasAuthorization = true
		}
		if h == "cookie" {
			hasCookie = true
		}
	}
	if !hasAuthorization {
		t.Error("MaskedHeaders missing 'authorization'")
	}
	if !hasCookie {
		t.Error("MaskedHeaders missing 'cookie'")
	}

	if len(cfg.MaskedBodyFields) != 7 {
		t.Errorf("len(MaskedBodyFields) = %d, want 7", len(cfg.MaskedBodyFields))
	}
	hasPassword := false
	hasToken := false
	for _, f := range cfg.MaskedBodyFields {
		if f == "password" {
			hasPassword = true
		}
		if f == "token" {
			hasToken = true
		}
	}
	if !hasPassword {
		t.Error("MaskedBodyFields missing 'password'")
	}
	if !hasToken {
		t.Error("MaskedBodyFields missing 'token'")
	}
}

func TestApiRequestJSONRoundTrip(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	original := models.ApiRequest{
		ID:           42,
		ServiceID:    "svc-001",
		RequestID:    "req-abc",
		Method:       "POST",
		Path:         "/api/users/123",
		PathTemplate: "/api/users/:id",
		StatusCode:   201,
		DurationMs:   55,
		ClientIP:     "10.0.0.1",
		ReqHeaders:   json.RawMessage(`{"content-type":"application/json"}`),
		ReqBody:      `{"name":"alice"}`,
		ReqBodySize:  16,
		ResHeaders:   json.RawMessage(`{"x-request-id":"xyz"}`),
		ResBody:      `{"id":123}`,
		ResBodySize:  10,
		Error:        "",
		IsError:      false,
		CreatedAt:    now,
	}

	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("json.Marshal failed: %v", err)
	}

	var decoded models.ApiRequest
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("json.Unmarshal failed: %v", err)
	}

	if decoded.ID != original.ID {
		t.Errorf("ID = %d, want %d", decoded.ID, original.ID)
	}
	if decoded.ServiceID != original.ServiceID {
		t.Errorf("ServiceID = %q, want %q", decoded.ServiceID, original.ServiceID)
	}
	if decoded.Method != original.Method {
		t.Errorf("Method = %q, want %q", decoded.Method, original.Method)
	}
	if decoded.PathTemplate != original.PathTemplate {
		t.Errorf("PathTemplate = %q, want %q", decoded.PathTemplate, original.PathTemplate)
	}
	if decoded.StatusCode != original.StatusCode {
		t.Errorf("StatusCode = %d, want %d", decoded.StatusCode, original.StatusCode)
	}
	if decoded.DurationMs != original.DurationMs {
		t.Errorf("DurationMs = %d, want %d", decoded.DurationMs, original.DurationMs)
	}
	if decoded.IsError != original.IsError {
		t.Errorf("IsError = %v, want %v", decoded.IsError, original.IsError)
	}
	if !decoded.CreatedAt.Equal(original.CreatedAt) {
		t.Errorf("CreatedAt = %v, want %v", decoded.CreatedAt, original.CreatedAt)
	}

	// Verify JSON field names via raw map
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("raw unmarshal failed: %v", err)
	}
	for _, key := range []string{"id", "serviceId", "requestId", "method", "path", "pathTemplate",
		"statusCode", "durationMs", "reqBodySize", "resBodySize", "isError", "createdAt"} {
		if _, ok := raw[key]; !ok {
			t.Errorf("JSON key %q missing from marshaled output", key)
		}
	}
}

func TestApiCaptureModesAreDefined(t *testing.T) {
	cases := []struct {
		name string
		val  models.ApiCaptureMode
		want string
	}{
		{"Disabled", models.CaptureModeDisabled, "disabled"},
		{"ErrorsOnly", models.CaptureModeErrorsOnly, "errors_only"},
		{"Sampled", models.CaptureModeSampled, "sampled"},
		{"All", models.CaptureModeAll, "all"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if string(tc.val) != tc.want {
				t.Errorf("ApiCaptureMode %s = %q, want %q", tc.name, tc.val, tc.want)
			}
		})
	}
}
