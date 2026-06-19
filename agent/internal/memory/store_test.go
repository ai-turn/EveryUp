package memory

import (
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestStoreRecordsAndFindsSimilarIncidents(t *testing.T) {
	store, err := Open(filepath.Join(t.TempDir(), "memory.db"))
	if err != nil {
		t.Fatalf("Open returned error: %v", err)
	}
	defer store.Close()

	incident := Incident{
		StartedAt:   time.Date(2026, 6, 18, 1, 2, 3, 0, time.UTC),
		ServiceName: "api",
		TargetKey:   "container-1",
		Severity:    "critical",
		Message:     "http://api:8080/health returned status 502 bad gateway",
		Metadata:    map[string]interface{}{"statusCode": 502},
	}
	if err := store.RecordAlert(t.Context(), incident); err != nil {
		t.Fatalf("RecordAlert returned error: %v", err)
	}

	matches, err := store.Similar(t.Context(), Incident{
		ServiceName: "api",
		TargetKey:   "container-1",
		Message:     "api 502 bad gateway",
	}, 5)
	if err != nil {
		t.Fatalf("Similar returned error: %v", err)
	}
	if len(matches) != 1 {
		t.Fatalf("expected one match, got %d", len(matches))
	}
	if matches[0].Score == 0 {
		t.Fatal("expected positive similarity score")
	}
}

func TestStoreResolvesLatestIncident(t *testing.T) {
	store, err := Open(filepath.Join(t.TempDir(), "memory.db"))
	if err != nil {
		t.Fatalf("Open returned error: %v", err)
	}
	defer store.Close()

	if err := store.RecordAlert(t.Context(), Incident{ServiceName: "api", TargetKey: "target", Message: "connection refused"}); err != nil {
		t.Fatalf("RecordAlert returned error: %v", err)
	}
	if err := store.ResolveLatest(t.Context(), "api", "target", time.Now()); err != nil {
		t.Fatalf("ResolveLatest returned error: %v", err)
	}
	latest, ok, err := store.LatestForService(t.Context(), "api", "target")
	if err != nil {
		t.Fatalf("LatestForService returned error: %v", err)
	}
	if !ok || latest.Status != "resolved" || latest.ResolvedAt.IsZero() {
		t.Fatalf("incident was not resolved: ok=%t latest=%+v", ok, latest)
	}
}

func TestReports(t *testing.T) {
	incident := Incident{
		ID:          1,
		StartedAt:   time.Date(2026, 6, 18, 1, 2, 3, 0, time.UTC),
		ServiceName: "api",
		Status:      "open",
		Message:     "connection refused",
	}
	text := DraftPostmortem(incident, []SimilarIncident{{Incident: incident, Score: 5}})
	if !strings.Contains(text, "Postmortem draft") || !strings.Contains(text, "Similar history") {
		t.Fatalf("unexpected postmortem draft: %s", text)
	}
	if got := FormatSimilar(nil); !strings.Contains(got, "No similar") {
		t.Fatalf("unexpected similar text: %s", got)
	}
}
