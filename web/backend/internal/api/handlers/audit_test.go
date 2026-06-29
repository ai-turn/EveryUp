package handlers_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/aiturn/everyup/internal/crypto"
)

func TestAudit_GetAllForbiddenForNonAdmin(t *testing.T) {
	ts := setupTestServer(t)
	ts.setupAdmin(t, "admin", "testpass123")

	token, err := crypto.SignToken(crypto.UserClaims{UserID: 99, Username: "viewer", Role: "viewer"})
	if err != nil {
		t.Fatalf("sign viewer token: %v", err)
	}

	resp, result := ts.doRequest(t, "GET", "/api/v1/audit", nil, authHeader(token)...)
	if resp.StatusCode != http.StatusForbidden || result.Success {
		t.Fatalf("non-admin audit access status=%d success=%v, want 403", resp.StatusCode, result.Success)
	}
}

func TestAudit_GetAllReturnsBodyViewEventsForAdmin(t *testing.T) {
	ts := setupTestServer(t)
	adminToken := ts.setupAdmin(t, "admin", "testpass123")
	seedSpanWithCapturedBody(t, "trace-audit-read")

	// Admin viewing a captured body writes an audit event as a side effect.
	if resp, _ := ts.doRequest(t, "GET", "/api/v1/traces/trace-audit-read", nil, authHeader(adminToken)...); resp.StatusCode != http.StatusOK {
		t.Fatalf("seed view status=%d", resp.StatusCode)
	}

	resp, result := ts.doRequest(t, "GET", "/api/v1/audit?action=trace.body.view", nil, authHeader(adminToken)...)
	if resp.StatusCode != http.StatusOK || !result.Success {
		t.Fatalf("audit read status=%d success=%v error=%+v", resp.StatusCode, result.Success, result.Error)
	}

	var events []struct {
		Action  string `json:"action"`
		TraceID string `json:"traceId"`
	}
	if err := json.Unmarshal(result.Data, &events); err != nil {
		t.Fatalf("decode audit events: %v", err)
	}
	if len(events) != 1 || events[0].Action != "trace.body.view" || events[0].TraceID != "trace-audit-read" {
		t.Fatalf("unexpected audit events: %+v", events)
	}
}
