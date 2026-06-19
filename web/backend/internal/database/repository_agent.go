package database

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

type AgentRepository struct{}

func NewAgentRepository() *AgentRepository {
	return &AgentRepository{}
}

func (r *AgentRepository) UpsertAgent(agent models.Agent) error {
	now := time.Now()
	if agent.LastSeenAt.IsZero() {
		agent.LastSeenAt = now
	}
	_, err := DB.Exec(`
INSERT INTO agents(id, name, mode, version, last_seen_at, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
	name = excluded.name,
	mode = excluded.mode,
	version = excluded.version,
	last_seen_at = excluded.last_seen_at,
	updated_at = excluded.updated_at`,
		agent.ID, agent.Name, agent.Mode, agent.Version, agent.LastSeenAt, now, now)
	return err
}

func (r *AgentRepository) FindAgentByNameMode(name, mode string) (models.Agent, bool, error) {
	var agent models.Agent
	err := DB.QueryRow(`
SELECT id, name, mode, version, last_seen_at, created_at, updated_at
FROM agents
WHERE name = ? AND mode = ?
ORDER BY last_seen_at DESC
LIMIT 1`, name, mode).Scan(&agent.ID, &agent.Name, &agent.Mode, &agent.Version, &agent.LastSeenAt, &agent.CreatedAt, &agent.UpdatedAt)
	if err == sql.ErrNoRows {
		return models.Agent{}, false, nil
	}
	if err != nil {
		return models.Agent{}, false, err
	}
	return agent, true, nil
}

func (r *AgentRepository) GetAllAgents() ([]models.Agent, error) {
	rows, err := DB.Query(`SELECT id, name, mode, version, last_seen_at, created_at, updated_at FROM agents ORDER BY last_seen_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	agents := make([]models.Agent, 0)
	for rows.Next() {
		var agent models.Agent
		if err := rows.Scan(&agent.ID, &agent.Name, &agent.Mode, &agent.Version, &agent.LastSeenAt, &agent.CreatedAt, &agent.UpdatedAt); err != nil {
			return nil, err
		}
		agents = append(agents, agent)
	}
	return agents, rows.Err()
}

func (r *AgentRepository) UpsertServices(agentID string, observedAt time.Time, services []models.AgentService) error {
	if observedAt.IsZero() {
		observedAt = time.Now()
	}
	return Transaction(func(tx *sql.Tx) error {
		if _, err := tx.Exec(`UPDATE agents SET last_seen_at = ?, updated_at = ? WHERE id = ?`, observedAt, time.Now(), agentID); err != nil {
			return err
		}
		for _, service := range services {
			if service.UpdatedAt.IsZero() {
				service.UpdatedAt = observedAt
			}
			if _, err := tx.Exec(`
INSERT INTO agent_services(agent_id, key, name, check_type, endpoint, healthy, seen, silenced, last_error, last_status, last_latency, updated_at, observed_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(agent_id, key) DO UPDATE SET
	name = excluded.name,
	check_type = excluded.check_type,
	endpoint = excluded.endpoint,
	healthy = excluded.healthy,
	seen = excluded.seen,
	silenced = excluded.silenced,
	last_error = excluded.last_error,
	last_status = excluded.last_status,
	last_latency = excluded.last_latency,
	updated_at = excluded.updated_at,
	observed_at = excluded.observed_at`,
				agentID, service.Key, service.Name, service.CheckType, service.Endpoint, boolInt(service.Healthy), boolInt(service.Seen),
				boolInt(service.Silenced), service.LastError, service.LastStatus, service.LastLatency, service.UpdatedAt, observedAt); err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *AgentRepository) GetServices(agentID string) ([]models.AgentService, error) {
	rows, err := DB.Query(`
SELECT agent_id, key, name, check_type, endpoint, healthy, seen, silenced, last_error, last_status, last_latency, updated_at, observed_at
FROM agent_services WHERE agent_id = ? ORDER BY name`, agentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	services := make([]models.AgentService, 0)
	for rows.Next() {
		var service models.AgentService
		var healthy, seen, silenced int
		if err := rows.Scan(&service.AgentID, &service.Key, &service.Name, &service.CheckType, &service.Endpoint,
			&healthy, &seen, &silenced, &service.LastError, &service.LastStatus, &service.LastLatency, &service.UpdatedAt, &service.ObservedAt); err != nil {
			return nil, err
		}
		service.Healthy = healthy == 1
		service.Seen = seen == 1
		service.Silenced = silenced == 1
		services = append(services, service)
	}
	return services, rows.Err()
}

func (r *AgentRepository) InsertEvents(agentID string, events []models.AgentEvent) error {
	if len(events) == 0 {
		return nil
	}
	now := time.Now()
	return Transaction(func(tx *sql.Tx) error {
		if _, err := tx.Exec(`UPDATE agents SET last_seen_at = ?, updated_at = ? WHERE id = ?`, now, now, agentID); err != nil {
			return err
		}
		for _, event := range events {
			if event.Time.IsZero() {
				event.Time = now
			}
			metadata, err := json.Marshal(event.Metadata)
			if err != nil {
				return err
			}
			if _, err := tx.Exec(`
INSERT INTO agent_events(agent_id, time, type, service_name, target_key, message, metadata_json, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				agentID, event.Time, event.Type, event.ServiceName, event.TargetKey, event.Message, string(metadata), now); err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *AgentRepository) GetEvents(agentID string, limit int) ([]models.AgentEvent, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := DB.Query(`
SELECT id, agent_id, time, type, service_name, target_key, message, metadata_json, created_at
FROM agent_events WHERE agent_id = ? ORDER BY time DESC LIMIT ?`, agentID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	events := make([]models.AgentEvent, 0)
	for rows.Next() {
		var event models.AgentEvent
		var metadata string
		if err := rows.Scan(&event.ID, &event.AgentID, &event.Time, &event.Type, &event.ServiceName, &event.TargetKey, &event.Message, &metadata, &event.CreatedAt); err != nil {
			return nil, err
		}
		if metadata != "" {
			_ = json.Unmarshal([]byte(metadata), &event.Metadata)
		}
		events = append(events, event)
	}
	return events, rows.Err()
}

func boolInt(value bool) int {
	if value {
		return 1
	}
	return 0
}
