package database

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// parseLatencyMs converts a Go duration string (e.g. "123ms", "1.5s") to milliseconds.
func parseLatencyMs(s string) int {
	if s == "" {
		return 0
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return 0
	}
	return int(d.Milliseconds())
}

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
			// Record each sync as a history point for time-series charts.
			if _, err := tx.Exec(`
INSERT INTO agent_service_history(agent_id, key, healthy, latency_ms, recorded_at)
VALUES (?, ?, ?, ?, ?)`,
				agentID, service.Key, boolInt(service.Healthy), parseLatencyMs(service.LastLatency), observedAt); err != nil {
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

func (r *AgentRepository) GetServiceByKey(agentID, key string) (*models.AgentService, error) {
	var service models.AgentService
	var healthy, seen, silenced int
	err := DB.QueryRow(`
SELECT agent_id, key, name, check_type, endpoint, healthy, seen, silenced, last_error, last_status, last_latency, updated_at, observed_at
FROM agent_services WHERE agent_id = ? AND key = ?`, agentID, key).Scan(
		&service.AgentID, &service.Key, &service.Name, &service.CheckType, &service.Endpoint,
		&healthy, &seen, &silenced, &service.LastError, &service.LastStatus, &service.LastLatency, &service.UpdatedAt, &service.ObservedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	service.Healthy = healthy == 1
	service.Seen = seen == 1
	service.Silenced = silenced == 1
	return &service, nil
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

// GetAllServicesFlat returns all agent services joined with agent name for list views.
func (r *AgentRepository) GetAllServicesFlat() ([]models.AgentServiceFlat, error) {
	rows, err := DB.Query(`
SELECT s.agent_id, s.key, s.name, s.check_type, s.endpoint, s.healthy, s.seen, s.silenced,
       s.last_error, s.last_status, s.last_latency, s.updated_at, s.observed_at, a.name
FROM agent_services s
JOIN agents a ON a.id = s.agent_id
ORDER BY a.name, s.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.AgentServiceFlat, 0)
	for rows.Next() {
		var f models.AgentServiceFlat
		var healthy, seen, silenced int
		if err := rows.Scan(
			&f.AgentID, &f.Key, &f.Name, &f.CheckType, &f.Endpoint,
			&healthy, &seen, &silenced,
			&f.LastError, &f.LastStatus, &f.LastLatency,
			&f.UpdatedAt, &f.ObservedAt, &f.AgentName,
		); err != nil {
			return nil, err
		}
		f.Healthy = healthy == 1
		f.Seen = seen == 1
		f.Silenced = silenced == 1
		out = append(out, f)
	}
	return out, rows.Err()
}

// GetServiceHistoryBuckets returns time-bucketed history points for response-time charts.
// Records are fetched raw then bucketed in Go to avoid complex SQLite time math.
func (r *AgentRepository) GetServiceHistoryBuckets(agentID, key string, since time.Time, bucketMins int) ([]models.ServiceHistoryPoint, error) {
	rows, err := DB.Query(`
SELECT healthy, latency_ms, recorded_at
FROM agent_service_history
WHERE agent_id = ? AND key = ? AND recorded_at >= ?
ORDER BY recorded_at`,
		agentID, key, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type raw struct {
		healthy    int
		latencyMs  int
		recordedAt time.Time
	}
	var records []raw
	for rows.Next() {
		var r raw
		if err := rows.Scan(&r.healthy, &r.latencyMs, &r.recordedAt); err != nil {
			return nil, err
		}
		records = append(records, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(records) == 0 {
		return []models.ServiceHistoryPoint{}, nil
	}

	// Bucket by truncating to the nearest N-minute interval.
	bucketDur := time.Duration(bucketMins) * time.Minute
	type bucket struct {
		sumLatency float64
		healthy    int
		total      int
	}
	ordered := make([]time.Time, 0)
	buckets := make(map[time.Time]*bucket)
	for _, rec := range records {
		t := rec.recordedAt.Truncate(bucketDur)
		if _, ok := buckets[t]; !ok {
			buckets[t] = &bucket{}
			ordered = append(ordered, t)
		}
		b := buckets[t]
		b.total++
		b.healthy += rec.healthy
		b.sumLatency += float64(rec.latencyMs)
	}

	points := make([]models.ServiceHistoryPoint, 0, len(ordered))
	for _, t := range ordered {
		b := buckets[t]
		avgLat := 0.0
		if b.total > 0 {
			avgLat = b.sumLatency / float64(b.total)
		}
		uptimePct := 0.0
		if b.total > 0 {
			uptimePct = float64(b.healthy) * 100.0 / float64(b.total)
		}
		points = append(points, models.ServiceHistoryPoint{
			Time:      t.UTC().Format(time.RFC3339),
			LatencyMs: avgLat,
			UptimePct: uptimePct,
			Total:     b.total,
		})
	}
	return points, nil
}

// GetServiceUptimeByDay returns per-day uptime percentages for up to `days` days.
func (r *AgentRepository) GetServiceUptimeByDay(agentID, key string, days int) ([]models.ServiceUptimeDay, error) {
	since := time.Now().AddDate(0, 0, -days).Format("2006-01-02")
	rows, err := DB.Query(`
SELECT date(recorded_at) as day,
       SUM(healthy)         as healthy_count,
       COUNT(*)             as total_count
FROM agent_service_history
WHERE agent_id = ? AND key = ? AND date(recorded_at) >= ?
GROUP BY day
ORDER BY day`,
		agentID, key, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.ServiceUptimeDay, 0)
	for rows.Next() {
		var d models.ServiceUptimeDay
		if err := rows.Scan(&d.Date, &d.HealthyChecks, &d.TotalChecks); err != nil {
			return nil, err
		}
		if d.TotalChecks > 0 {
			d.UptimePct = float64(d.HealthyChecks) * 100.0 / float64(d.TotalChecks)
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// GetServiceKeyEvents returns agent_events filtered to a specific service key.
func (r *AgentRepository) GetServiceKeyEvents(agentID, key string, limit int) ([]models.AgentEvent, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := DB.Query(`
SELECT id, agent_id, time, type, service_name, target_key, message, metadata_json, created_at
FROM agent_events
WHERE agent_id = ? AND target_key = ?
ORDER BY time DESC LIMIT ?`,
		agentID, key, limit)
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
