package database_test

import (
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

func TestAgentRepositoryRoundTrip(t *testing.T) {
	openTestDB(t)

	repo := database.NewAgentRepository()
	agent := models.Agent{
		ID:         "agent-1",
		Name:       "edge-agent",
		Mode:       "standalone",
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
	found, ok, err := repo.FindAgentByNameMode(agent.Name, agent.Mode)
	if err != nil {
		t.Fatalf("FindAgentByNameMode returned error: %v", err)
	}
	if !ok || found.ID != agent.ID {
		t.Fatalf("unexpected found agent: ok=%t agent=%+v", ok, found)
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
