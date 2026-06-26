package accesslog

import (
	"testing"
	"time"
)

func TestParseQuotedAccessLog(t *testing.T) {
	now := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	req, ok := Parse(`10.0.0.1 - - [02/Jan/2026:03:04:05 +0000] "GET /api/users?id=1 HTTP/1.1" 200 123 17ms`, now)
	if !ok {
		t.Fatal("Parse() ok = false")
	}
	if req.Method != "GET" || req.Path != "/api/users" || req.StatusCode != 200 || req.ClientIP != "10.0.0.1" {
		t.Fatalf("unexpected request: %+v", req)
	}
	if req.Duration != 17*time.Millisecond {
		t.Fatalf("Duration = %s, want 17ms", req.Duration)
	}
}

func TestParseKeyValueAccessLog(t *testing.T) {
	req, ok := Parse(`level=info method=POST path=/login status=401 duration=42ms client_ip=127.0.0.1`, time.Time{})
	if !ok {
		t.Fatal("Parse() ok = false")
	}
	if req.Method != "POST" || req.Path != "/login" || req.StatusCode != 401 || req.Duration != 42*time.Millisecond {
		t.Fatalf("unexpected request: %+v", req)
	}
}

func TestParseJSONAccessLog(t *testing.T) {
	req, ok := Parse(`{"method":"PATCH","path":"/orders/123","status":204,"duration_ms":8,"client_ip":"192.168.0.5"}`, time.Time{})
	if !ok {
		t.Fatal("Parse() ok = false")
	}
	if req.Method != "PATCH" || req.Path != "/orders/123" || req.StatusCode != 204 || req.Duration != 8*time.Millisecond {
		t.Fatalf("unexpected request: %+v", req)
	}
}
