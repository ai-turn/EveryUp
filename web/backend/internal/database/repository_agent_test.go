package database_test

import (
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

func TestAgentJoinCodeCanOnlyBeConsumedOnce(t *testing.T) {
	openTestDB(t)

	repo := database.NewAgentRepository()
	now := time.Now().UTC().Truncate(time.Second)
	agent := models.Agent{ID: "agent-join", Name: "join-target"}
	if err := repo.CreateAgentWithJoinCode(agent, "api-hash", "encrypted-api-key", "join-hash", now.Add(10*time.Minute)); err != nil {
		t.Fatalf("CreateAgentWithJoinCode: %v", err)
	}

	credential, err := repo.ConsumeJoinCode("join-hash", now)
	if err != nil {
		t.Fatalf("ConsumeJoinCode: %v", err)
	}
	if credential.AgentID != agent.ID || credential.AgentName != agent.Name || credential.KeyEnc != "encrypted-api-key" {
		t.Fatalf("unexpected credential: %+v", credential)
	}
	if _, err := repo.ConsumeJoinCode("join-hash", now); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("second ConsumeJoinCode error = %v, want sql.ErrNoRows", err)
	}
}

func TestAgentJoinCodeExpiryAndReplacement(t *testing.T) {
	openTestDB(t)

	repo := database.NewAgentRepository()
	now := time.Now().UTC().Truncate(time.Second)
	agent := models.Agent{ID: "agent-expiry", Name: "expiry-target"}
	if err := repo.CreateAgentWithJoinCode(agent, "api-hash-2", "encrypted-api-key", "expired-hash", now.Add(-time.Second)); err != nil {
		t.Fatalf("CreateAgentWithJoinCode: %v", err)
	}
	if _, err := repo.ConsumeJoinCode("expired-hash", now); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("expired ConsumeJoinCode error = %v, want sql.ErrNoRows", err)
	}

	if err := repo.IssueJoinCode(agent.ID, "replacement-hash", now.Add(10*time.Minute)); err != nil {
		t.Fatalf("IssueJoinCode: %v", err)
	}
	if _, err := repo.ConsumeJoinCode("replacement-hash", now); err != nil {
		t.Fatalf("replacement ConsumeJoinCode: %v", err)
	}
	if err := repo.IssueJoinCode("missing-agent", "unused", now.Add(time.Minute)); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("missing agent IssueJoinCode error = %v, want sql.ErrNoRows", err)
	}
}

func TestAgentRepositoryRoundTrip(t *testing.T) {
	openTestDB(t)

	repo := database.NewAgentRepository()
	agent := models.Agent{
		ID:         "agent-1",
		Name:       "edge-agent",
		Version:    "dev",
		LastSeenAt: time.Now().UTC().Truncate(time.Second),
	}
	if err := repo.UpsertAgent(agent); err != nil {
		t.Fatalf("UpsertAgent returned error: %v", err)
	}

	if err := repo.UpsertServices(agent.ID, agent.LastSeenAt, []models.AgentService{{
		AgentID:    agent.ID,
		Key:        "container-1",
		Name:       "api",
		CheckType:  "http",
		Endpoint:   "http://api:8080/health",
		Healthy:    true,
		Seen:       true,
		ObservedAt: agent.LastSeenAt,
	}}); err != nil {
		t.Fatalf("UpsertServices returned error: %v", err)
	}
	report := models.CapabilityReport{
		CheckedAt:           agent.LastSeenAt,
		Host:                models.HostCompatibility{OS: "Ubuntu 24.04 LTS", Arch: "amd64", KernelVersion: "6.8.0", BTF: true, Lockdown: "none"},
		ContainerMonitoring: models.CapabilityStatus{State: "available"},
		HostMetrics:         models.CapabilityStatus{State: "available"},
		AutomaticTracing:    models.CapabilityStatus{State: "degraded", Reason: "observer_not_running"},
		ContextPropagation:  models.CapabilityStatus{State: "unavailable", Reason: "automatic_tracing_unavailable"},
	}
	if err := repo.UpdateCapabilityReport(agent.ID, report); err != nil {
		t.Fatalf("UpdateCapabilityReport returned error: %v", err)
	}

	if err := repo.InsertEvents(agent.ID, []models.AgentEvent{{
		Time:        agent.LastSeenAt,
		Type:        "alert_sent",
		ServiceName: "api",
		TargetKey:   "container-1",
		Message:     "api failed",
		Metadata:    map[string]interface{}{"source": "test"},
	}}); err != nil {
		t.Fatalf("InsertEvents returned error: %v", err)
	}

	agents, err := repo.GetAllAgents()
	if err != nil {
		t.Fatalf("GetAllAgents returned error: %v", err)
	}
	if len(agents) != 1 || agents[0].ID != agent.ID {
		t.Fatalf("unexpected agents: %+v", agents)
	}
	if agents[0].Capabilities == nil || agents[0].Capabilities.Host.KernelVersion != "6.8.0" || agents[0].Capabilities.AutomaticTracing.Reason != "observer_not_running" {
		t.Fatalf("unexpected capability report: %+v", agents[0].Capabilities)
	}
	services, err := repo.GetServices(agent.ID)
	if err != nil {
		t.Fatalf("GetServices returned error: %v", err)
	}
	if len(services) != 1 || services[0].Name != "api" || !services[0].Healthy {
		t.Fatalf("unexpected services: %+v", services)
	}

	events, err := repo.GetEvents(agent.ID, 10)
	if err != nil {
		t.Fatalf("GetEvents returned error: %v", err)
	}
	if len(events) != 1 || events[0].Type != "alert_sent" {
		t.Fatalf("unexpected events: %+v", events)
	}
}

// Agent-level uptime rollup + incident derivation from history transitions.
func TestAgentUptimeAndIncidents(t *testing.T) {
	openTestDB(t)

	repo := database.NewAgentRepository()
	agent := models.Agent{ID: "agent-1", Name: "prod", LastSeenAt: time.Now()}
	if err := repo.UpsertAgent(agent); err != nil {
		t.Fatalf("UpsertAgent: %v", err)
	}

	svc := func(key string, healthy bool) models.AgentService {
		return models.AgentService{AgentID: agent.ID, Key: key, Name: key + "-svc", CheckType: "http", Endpoint: "http://x", Healthy: healthy, Seen: true}
	}
	// t0: all healthy → t1,t2: a down → t3: a recovered, c goes down (still open)
	now := time.Now()
	steps := []struct {
		at       time.Time
		aOK, cOK bool
	}{
		{now.Add(-3 * time.Hour), true, true},
		{now.Add(-2 * time.Hour), false, true},
		{now.Add(-1 * time.Hour), false, true},
		{now.Add(-30 * time.Minute), true, false},
	}
	for _, s := range steps {
		if err := repo.UpsertServices(agent.ID, s.at, []models.AgentService{svc("a", s.aOK), svc("b", true), svc("c", s.cOK)}); err != nil {
			t.Fatalf("UpsertServices: %v", err)
		}
	}

	days, err := repo.GetAgentUptimeByDay(agent.ID, 90)
	if err != nil {
		t.Fatalf("GetAgentUptimeByDay: %v", err)
	}
	total, healthy := 0, 0
	for _, d := range days {
		total += d.TotalChecks
		healthy += d.HealthyChecks
	}
	if total != 12 || healthy != 9 { // 4 syncs × 3 services, 3 unhealthy points (a×2, c×1)
		t.Fatalf("uptime rollup: total=%d healthy=%d, want 12/9", total, healthy)
	}

	incidents, err := repo.GetAgentIncidents(agent.ID, 30, 20)
	if err != nil {
		t.Fatalf("GetAgentIncidents: %v", err)
	}
	if len(incidents) != 2 {
		t.Fatalf("expected 2 incidents, got %+v", incidents)
	}
	// newest first: c is still open, a was resolved
	if incidents[0].Key != "c" || !incidents[0].Active || incidents[0].EndedAt != nil {
		t.Fatalf("unexpected open incident: %+v", incidents[0])
	}
	if incidents[0].ServiceName != "c-svc" || incidents[0].DurationSec <= 0 {
		t.Fatalf("open incident name/duration: %+v", incidents[0])
	}
	if incidents[1].Key != "a" || incidents[1].Active || incidents[1].EndedAt == nil {
		t.Fatalf("unexpected resolved incident: %+v", incidents[1])
	}
	// a: started -2h, first healthy check again at -30m → 90min
	if got := incidents[1].DurationSec; got < 5300 || got > 5500 {
		t.Fatalf("resolved incident duration: %d", got)
	}
}
