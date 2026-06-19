package chatops

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"
)

type fakeProvider struct {
	snapshot Snapshot
}

func (p fakeProvider) ChatOpsSnapshot(ctx context.Context) Snapshot {
	return p.snapshot
}

func (p fakeProvider) ExplainService(ctx context.Context, serviceRef string) string {
	return "explained " + serviceRef
}

func (p fakeProvider) SilenceService(ctx context.Context, serviceRef string, duration time.Duration, reason string) string {
	return fmt.Sprintf("silenced %s for %s: %s", serviceRef, duration, reason)
}

func (p fakeProvider) ServiceLogs(ctx context.Context, serviceRef string, lines int) string {
	return fmt.Sprintf("logs %s %d", serviceRef, lines)
}

func (p fakeProvider) RequestRestart(ctx context.Context, chatID, serviceRef string) string {
	return "restart requested " + chatID + " " + serviceRef
}

func (p fakeProvider) ConfirmAction(ctx context.Context, chatID, token string) string {
	return "confirmed " + chatID + " " + token
}

func (p fakeProvider) PendingActions(ctx context.Context) string {
	return "pending actions"
}

type fakeAudit struct {
	events int
}

func (a *fakeAudit) AuditChatOps(eventType, chatID, command, message string) {
	a.events++
}

func TestHandlerStatus(t *testing.T) {
	audit := &fakeAudit{}
	handler := NewHandler(fakeProvider{snapshot: Snapshot{
		AgentName: "agent-1",
		Now:       time.Date(2026, 6, 18, 1, 2, 3, 0, time.UTC),
		Services: []ServiceStatus{
			{Name: "api", Seen: true, Healthy: true},
			{Name: "db", Seen: true, Healthy: false},
			{Name: "cache"},
		},
	}}, audit)

	got := handler.Handle(t.Context(), "123", "/status")
	for _, want := range []string{"agent-1", "3 total", "1 healthy", "1 unhealthy", "1 unknown"} {
		if !strings.Contains(got, want) {
			t.Fatalf("status response missing %q:\n%s", want, got)
		}
	}
	if audit.events != 1 {
		t.Fatalf("audit events = %d, want 1", audit.events)
	}
}

func TestHandlerServices(t *testing.T) {
	handler := NewHandler(fakeProvider{snapshot: Snapshot{
		AgentName: "agent-1",
		Now:       time.Now(),
		Services: []ServiceStatus{
			{Name: "db", CheckType: "tcp", Endpoint: "db:5432", Seen: true, Healthy: false, LastError: "connection refused"},
			{Name: "api", CheckType: "http", Endpoint: "http://api:8080/health", Seen: true, Healthy: true},
		},
	}}, nil)

	got := handler.Handle(t.Context(), "123", "/services")
	if !strings.Contains(got, "api: healthy") || !strings.Contains(got, "db: unhealthy") {
		t.Fatalf("unexpected services response:\n%s", got)
	}
}

func TestHandlerExplain(t *testing.T) {
	handler := NewHandler(fakeProvider{}, nil)

	got := handler.Handle(t.Context(), "123", "/explain api")
	if got != "explained api" {
		t.Fatalf("explain response = %q", got)
	}
}

func TestHandlerSilence(t *testing.T) {
	handler := NewHandler(fakeProvider{}, nil)

	got := handler.Handle(t.Context(), "123", "/silence api 30m deploy")
	if !strings.Contains(got, "silenced api for 30m0s: deploy") {
		t.Fatalf("silence response = %q", got)
	}
}

func TestHandlerLogs(t *testing.T) {
	handler := NewHandler(fakeProvider{}, nil)

	got := handler.Handle(t.Context(), "123", "/logs api 25")
	if got != "logs api 25" {
		t.Fatalf("logs response = %q", got)
	}
}

func TestHandlerLogsRejectsInvalidLineCount(t *testing.T) {
	handler := NewHandler(fakeProvider{}, nil)

	got := handler.Handle(t.Context(), "123", "/logs api 0")
	if !strings.Contains(got, "Invalid line count") {
		t.Fatalf("logs response = %q", got)
	}
}

func TestHandlerRestartConfirmAndActions(t *testing.T) {
	handler := NewHandler(fakeProvider{}, nil)

	if got := handler.Handle(t.Context(), "123", "/restart api"); got != "restart requested 123 api" {
		t.Fatalf("restart response = %q", got)
	}
	if got := handler.Handle(t.Context(), "123", "/confirm abc123"); got != "confirmed 123 abc123" {
		t.Fatalf("confirm response = %q", got)
	}
	if got := handler.Handle(t.Context(), "123", "/actions"); got != "pending actions" {
		t.Fatalf("actions response = %q", got)
	}
}

func TestParseDurationRejectsInvalidDurations(t *testing.T) {
	tests := []string{"", "0s", "-1m", "240h"}
	for _, tt := range tests {
		t.Run(tt, func(t *testing.T) {
			if _, err := ParseDuration(tt); err == nil {
				t.Fatal("expected error")
			}
		})
	}
}
