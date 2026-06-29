package handlers_test

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/crypto"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

func TestTraces_GetByTraceIDRedactsCapturedBodiesForNonAdmin(t *testing.T) {
	ts := setupTestServer(t)
	ts.setupAdmin(t, "admin", "testpass123")
	seedSpanWithCapturedBody(t, "trace-redact")

	token, err := crypto.SignToken(crypto.UserClaims{UserID: 99, Username: "viewer", Role: "viewer"})
	if err != nil {
		t.Fatalf("sign viewer token: %v", err)
	}

	resp, result := ts.doRequest(t, "GET", "/api/v1/traces/trace-redact", nil, authHeader(token)...)
	if resp.StatusCode != http.StatusOK || !result.Success {
		t.Fatalf("GET trace status=%d success=%v error=%+v", resp.StatusCode, result.Success, result.Error)
	}

	attrs := firstCapturedBodyAttrs(t, result.Data)
	if _, ok := attrs["body"]; ok {
		t.Fatalf("non-admin response leaked captured body: %+v", attrs)
	}
	if attrs["body_redacted"] != true {
		t.Fatalf("body_redacted = %v, want true", attrs["body_redacted"])
	}
}

func TestTraces_GetByTraceIDAuditsCapturedBodyViewForAdmin(t *testing.T) {
	ts := setupTestServer(t)
	adminToken := ts.setupAdmin(t, "admin", "testpass123")
	seedSpanWithCapturedBody(t, "trace-audit")

	resp, result := ts.doRequest(t, "GET", "/api/v1/traces/trace-audit", nil, authHeader(adminToken)...)
	if resp.StatusCode != http.StatusOK || !result.Success {
		t.Fatalf("GET trace status=%d success=%v error=%+v", resp.StatusCode, result.Success, result.Error)
	}

	attrs := firstCapturedBodyAttrs(t, result.Data)
	if attrs["body"] != `{"token":"***"}` {
		t.Fatalf("admin body = %v, want masked payload", attrs["body"])
	}

	var count int
	if err := database.DB.QueryRow(`
		SELECT COUNT(*) FROM audit_events
		WHERE action = 'trace.body.view' AND trace_id = 'trace-audit' AND username = 'admin'
	`).Scan(&count); err != nil {
		t.Fatalf("query audit_events: %v", err)
	}
	if count != 1 {
		t.Fatalf("audit event count = %d, want 1", count)
	}
}

func seedSpanWithCapturedBody(t *testing.T, traceID string) {
	t.Helper()
	events := json.RawMessage(`[{"name":"request_body_masked","attributes":{"body":"{\"token\":\"***\"}","body_size":14,"body_truncated":false,"mask_applied":true}}]`)
	_, err := database.NewSpanRepository().CreateBatch([]models.Span{{
		TraceID:       traceID,
		SpanID:        "span-1",
		Name:          "POST /api/session",
		Kind:          "SERVER",
		StartUnixNano: uint64(time.Now().Add(-time.Second).UnixNano()),
		EndUnixNano:   uint64(time.Now().UnixNano()),
		DurationMs:    100,
		Events:        events,
		CreatedAt:     time.Now(),
	}})
	if err != nil {
		t.Fatalf("seed span: %v", err)
	}
}

func firstCapturedBodyAttrs(t *testing.T, raw json.RawMessage) map[string]interface{} {
	t.Helper()
	var data struct {
		Spans []struct {
			Events []struct {
				Name       string                 `json:"name"`
				Attributes map[string]interface{} `json:"attributes"`
			} `json:"events"`
		} `json:"spans"`
	}
	if err := json.Unmarshal(raw, &data); err != nil {
		t.Fatalf("decode trace data: %v", err)
	}
	for _, span := range data.Spans {
		for _, event := range span.Events {
			if event.Name == "request_body_masked" {
				return event.Attributes
			}
		}
	}
	t.Fatalf("captured body event not found in response: %s", string(raw))
	return nil
}
