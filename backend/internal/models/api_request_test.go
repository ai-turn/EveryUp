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

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("raw unmarshal failed: %v", err)
	}
	for _, key := range []string{"id", "serviceId", "requestId", "method", "path", "pathTemplate",
		"statusCode", "durationMs", "isError", "createdAt"} {
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
