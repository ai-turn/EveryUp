package agent

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/aiturn/everyup/agent/internal/discovery"
	"github.com/aiturn/everyup/agent/internal/hostmetrics"
	"github.com/aiturn/everyup/agent/internal/state"
)

func TestMatchLogKeywordUsesNewestMatchingLine(t *testing.T) {
	keyword, line, ok := matchLogKeyword([]string{
		"2026-06-19T00:00:00Z ERROR old failure",
		"2026-06-19T00:01:00Z info ok",
		"2026-06-19T00:02:00Z panic latest failure",
	}, []string{"ERROR", "panic"})
	if !ok {
		t.Fatal("expected keyword match")
	}
	if keyword != "panic" || line != "2026-06-19T00:02:00Z panic latest failure" {
		t.Fatalf("keyword=%q line=%q", keyword, line)
	}
}

func TestLogLineLimitUsesDefault(t *testing.T) {
	if got := logLineLimit(nil); got != 100 {
		t.Fatalf("logLineLimit = %d, want 100", got)
	}
}

func TestResourceThresholdsDisabledByDefault(t *testing.T) {
	cpu, memory := resourceThresholds(nil)
	if cpu != 0 || memory != 0 {
		t.Fatalf("thresholds = %f/%f, want disabled", cpu, memory)
	}
}

func TestPruneStaleStatesDropsVanishedTargets(t *testing.T) {
	a := &Agent{states: map[string]*targetState{
		"env:demo-prod":  {serviceName: "demo-prod"},
		"a52304deadbeef": {serviceName: ""}, // stale container ID, no longer discovered
		"host:metrics":   {serviceName: "host"},
	}}
	live := []discovery.Target{{ID: "env:demo-prod", ServiceName: "demo-prod"}}

	a.pruneStaleStates(live)

	if _, ok := a.states["a52304deadbeef"]; ok {
		t.Fatal("stale container target should be pruned")
	}
	if _, ok := a.states["env:demo-prod"]; !ok {
		t.Fatal("live target should be retained")
	}
	if _, ok := a.states["host:metrics"]; !ok {
		t.Fatal("host:metrics is internal state and must be retained")
	}
}

func TestRunDockerLivenessCheck(t *testing.T) {
	dir := t.TempDir()
	a := &Agent{
		states: map[string]*targetState{},
		store:  state.NewStore(filepath.Join(dir, "state.json")),
		audit:  state.NewAuditLogger(filepath.Join(dir, "audit.jsonl")),
	}
	a.cfg.AlertCooldown = time.Minute

	a.runDockerLivenessCheck(discovery.Target{ID: "c1", ServiceName: "api", HealthType: "docker", State: "running"})
	if st := a.states["c1"]; st == nil || !st.wasHealthy {
		t.Fatalf("running container should be healthy: %+v", st)
	}

	a.runDockerLivenessCheck(discovery.Target{ID: "c2", ServiceName: "db", HealthType: "docker", State: "exited", StatusText: "Exited (137) 2m ago"})
	st := a.states["c2"]
	if st == nil || st.wasHealthy {
		t.Fatalf("exited container should be down: %+v", st)
	}
	if st.lastError != "Exited (137) 2m ago" {
		t.Fatalf("lastError = %q, want the docker status line", st.lastError)
	}
}

func TestHostResourceViolations(t *testing.T) {
	violations := hostResourceViolations(hostmetrics.Snapshot{
		CPUPercent:    91,
		MemoryPercent: 40,
		DiskPercent:   95,
	}, 90, 80, 90)
	if len(violations) != 2 {
		t.Fatalf("violations = %#v", violations)
	}
}
