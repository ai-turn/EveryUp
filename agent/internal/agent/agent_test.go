package agent

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/aiturn/everyup/agent/internal/discovery"
	"github.com/aiturn/everyup/agent/internal/hostmetrics"
	"github.com/aiturn/everyup/agent/internal/state"
)

func TestExcludedTarget(t *testing.T) {
	const selfHost = "abc123def456" // 12-char short container id (docker hostname)
	cases := []struct {
		name     string
		target   discovery.Target
		patterns []string
		want     bool
	}{
		{"self by hostname prefix", discovery.Target{ID: "abc123def456789ff", ServiceName: "everyup-agent"}, nil, true},
		{"excluded by pattern substring", discovery.Target{ID: "ff00", ServiceName: "my-nginx-1"}, []string{"nginx"}, true},
		{"excluded case-insensitive", discovery.Target{ID: "ff01", ServiceName: "Redis"}, []string{"redis"}, true},
		{"kept normal service", discovery.Target{ID: "ff02", ServiceName: "my-app"}, []string{"nginx"}, false},
		{"empty patterns keep", discovery.Target{ID: "ff03", ServiceName: "demo"}, nil, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := excludedTarget(tc.target, tc.patterns, selfHost); got != tc.want {
				t.Fatalf("excludedTarget(%+v) = %v, want %v", tc.target, got, tc.want)
			}
		})
	}
}

func TestInferLogSeverity(t *testing.T) {
	cases := []struct {
		name string
		line string
		want string
	}{
		{"debug line with ERROR_MESSAGE column", "2026-06-26 10:00:00.123 DEBUG 1 --- [exec-8] o.s.jdbc.core.JdbcTemplate : Executing SQL [UPDATE t SET ERROR_MESSAGE = ?]", "DEBUG"},
		{"real error", "2026-06-26 10:00:00 ERROR 1 --- failed to connect", "ERROR"},
		{"warn", "2026-06-26 WARN slow query detected", "WARN"},
		{"plain text", "just a normal informational line", "INFO"},
		{"error word buried in body stays info", "INFO 1 --- request completed with no error", "INFO"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got, _ := inferLogSeverity(tc.line); got != tc.want {
				t.Fatalf("inferLogSeverity(%q) = %q, want %q", tc.line, got, tc.want)
			}
		})
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
