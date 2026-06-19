package watchdog

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestHeartbeatPingSendsAuth(t *testing.T) {
	var sawAuth bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "Bearer token" {
			sawAuth = true
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	heartbeat := NewHeartbeat(server.URL, "token", time.Second, server.Client())
	if err := heartbeat.Ping(t.Context()); err != nil {
		t.Fatalf("Ping returned error: %v", err)
	}
	if !sawAuth {
		t.Fatal("expected authorization header")
	}
}

func TestHeartbeatPingRejectsNonSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "down", http.StatusServiceUnavailable)
	}))
	defer server.Close()

	heartbeat := NewHeartbeat(server.URL, "", time.Second, server.Client())
	if err := heartbeat.Ping(t.Context()); err == nil {
		t.Fatal("expected non-success heartbeat to fail")
	}
}
