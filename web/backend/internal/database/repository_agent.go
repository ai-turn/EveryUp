package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// parseLatencyMs converts a Go duration string (e.g. "123ms", "1.5s", "400µs") to milliseconds.
// Returns float so sub-millisecond latencies (e.g. "400µs" → 0.4) survive instead of truncating to 0.
// ponytail: latency_ms column is INTEGER-affinity, but SQLite stores non-integer values as REAL — no migration needed.
func parseLatencyMs(s string) float64 {
	if s == "" {
		return 0
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return 0
	}
	return float64(d) / float64(time.Millisecond)
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
SELECT id, name, mode, version, COALESCE(status,'active'), last_seen_at, created_at, updated_at
FROM agents
WHERE name = ? AND mode = ?
ORDER BY last_seen_at DESC
LIMIT 1`, name, mode).Scan(&agent.ID, &agent.Name, &agent.Mode, &agent.Version, &agent.Status, &agent.LastSeenAt, &agent.CreatedAt, &agent.UpdatedAt)
	if err == sql.ErrNoRows {
		return models.Agent{}, false, nil
	}
	if err != nil {
		return models.Agent{}, false, err
	}
	return agent, true, nil
}

// FindAgentByKeyHash looks up an active agent by SHA-256 hex of its API key.
func (r *AgentRepository) FindAgentByKeyHash(hash string) (models.Agent, bool, error) {
	var agent models.Agent
	err := DB.QueryRow(`
SELECT id, name, mode, version, COALESCE(status,'active'), last_seen_at, created_at, updated_at
FROM agents
WHERE api_key_hash = ? AND COALESCE(status,'active') = 'active'
LIMIT 1`, hash).Scan(&agent.ID, &agent.Name, &agent.Mode, &agent.Version, &agent.Status, &agent.LastSeenAt, &agent.CreatedAt, &agent.UpdatedAt)
	if err == sql.ErrNoRows {
		return models.Agent{}, false, nil
	}
	if err != nil {
		return models.Agent{}, false, err
	}
	return agent, true, nil
}

// CreateAgent inserts a new pre-registered agent with a hashed API key (for auth)
// and the AES-encrypted key (so it can be revealed later in the UI).
func (r *AgentRepository) CreateAgent(agent models.Agent, keyHash, keyEnc string) error {
	now := time.Now()
	_, err := DB.Exec(`
INSERT INTO agents(id, name, mode, version, api_key_hash, api_key_enc, status, last_seen_at, created_at, updated_at)
VALUES (?, ?, ?, '', ?, ?, 'active', ?, ?, ?)`,
		agent.ID, agent.Name, agent.Mode, keyHash, keyEnc, now, now, now)
	return err
}

// GetAgentKeyEnc returns the stored encrypted API key for an agent. found is
// false when no agent row exists; enc is "" for agents created before key
// storage was added (only the hash exists, so the key cannot be revealed).
func (r *AgentRepository) GetAgentKeyEnc(id string) (enc string, found bool, err error) {
	var keyEnc sql.NullString
	err = DB.QueryRow(`SELECT api_key_enc FROM agents WHERE id = ?`, id).Scan(&keyEnc)
	if err == sql.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return keyEnc.String, true, nil
}

// UpdateAgentKey rotates an agent's API key (hash for auth, enc for reveal).
func (r *AgentRepository) UpdateAgentKey(id, keyHash, keyEnc string) error {
	res, err := DB.Exec(`UPDATE agents SET api_key_hash = ?, api_key_enc = ?, updated_at = ? WHERE id = ?`,
		keyHash, keyEnc, time.Now(), id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeactivateAgent sets an agent's status to 'inactive', preventing further enrollments.
func (r *AgentRepository) DeactivateAgent(id string) error {
	res, err := DB.Exec(`UPDATE agents SET status = 'inactive', updated_at = ? WHERE id = ?`, time.Now(), id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *AgentRepository) GetAllAgents() ([]models.Agent, error) {
	rows, err := DB.Query(`SELECT id, name, mode, version, COALESCE(status,'active'), last_seen_at, created_at, updated_at FROM agents WHERE COALESCE(status,'active') = 'active' ORDER BY last_seen_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	agents := make([]models.Agent, 0)
	for rows.Next() {
		var agent models.Agent
		if err := rows.Scan(&agent.ID, &agent.Name, &agent.Mode, &agent.Version, &agent.Status, &agent.LastSeenAt, &agent.CreatedAt, &agent.UpdatedAt); err != nil {
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
INSERT INTO agent_services(agent_id, key, name, check_type, endpoint, runtime, healthy, seen, silenced, last_error, last_status, last_latency, updated_at, observed_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(agent_id, key) DO UPDATE SET
	name = excluded.name,
	check_type = excluded.check_type,
	endpoint = excluded.endpoint,
	runtime = excluded.runtime,
	healthy = excluded.healthy,
	seen = excluded.seen,
	silenced = excluded.silenced,
	last_error = excluded.last_error,
	last_status = excluded.last_status,
	last_latency = excluded.last_latency,
	updated_at = excluded.updated_at,
	observed_at = excluded.observed_at`,
				agentID, service.Key, service.Name, service.CheckType, service.Endpoint, service.Runtime, boolInt(service.Healthy), boolInt(service.Seen),
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
		// Remove services that are no longer in the agent's current list.
		if len(services) > 0 {
			placeholders := make([]string, len(services))
			args := make([]interface{}, 0, 1+len(services))
			args = append(args, agentID)
			for i, s := range services {
				placeholders[i] = "?"
				args = append(args, s.Key)
			}
			q := fmt.Sprintf(
				"DELETE FROM agent_services WHERE agent_id = ? AND key NOT IN (%s)",
				strings.Join(placeholders, ", "),
			)
			if _, err := tx.Exec(q, args...); err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *AgentRepository) DeleteService(agentID, key string) error {
	_, err := DB.Exec(`DELETE FROM agent_services WHERE agent_id = ? AND key = ?`, agentID, key)
	return err
}

func (r *AgentRepository) GetServices(agentID string) ([]models.AgentService, error) {
	rows, err := DB.Query(`
SELECT agent_id, key, name, check_type, endpoint, runtime, healthy, seen, silenced, last_error, last_status, last_latency, updated_at, observed_at
FROM agent_services WHERE agent_id = ? ORDER BY name`, agentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	services := make([]models.AgentService, 0)
	for rows.Next() {
		var service models.AgentService
		var healthy, seen, silenced int
		if err := rows.Scan(&service.AgentID, &service.Key, &service.Name, &service.CheckType, &service.Endpoint, &service.Runtime,
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
SELECT agent_id, key, name, check_type, endpoint, runtime, healthy, seen, silenced, last_error, last_status, last_latency, updated_at, observed_at
FROM agent_services WHERE agent_id = ? AND key = ?`, agentID, key).Scan(
		&service.AgentID, &service.Key, &service.Name, &service.CheckType, &service.Endpoint, &service.Runtime,
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

// LogLevelFilterByName returns the per-service ingest log-level filter for the
// agent service whose name matches the OTLP service.name. Stored as CSV on
// agent_services; empty/missing = accept all levels. UpsertServices never writes
// this column, so a user-set filter survives agent re-syncs.
func (r *AgentRepository) LogLevelFilterByName(agentID, name string) []models.LogLevel {
	var csv string
	err := DB.QueryRow(
		`SELECT log_level_filter FROM agent_services WHERE agent_id = ? AND name = ? LIMIT 1`,
		agentID, name,
	).Scan(&csv)
	if err != nil || strings.TrimSpace(csv) == "" {
		return nil
	}
	parts := strings.Split(csv, ",")
	levels := make([]models.LogLevel, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			levels = append(levels, models.LogLevel(p))
		}
	}
	return levels
}

// GetLogLevelFilterByKey returns the per-service ingest filter as a level list,
// addressed by (agent_id, key) — the unit the UI edits. Empty = accept all.
func (r *AgentRepository) GetLogLevelFilterByKey(agentID, key string) ([]string, error) {
	var csv string
	err := DB.QueryRow(
		`SELECT log_level_filter FROM agent_services WHERE agent_id = ? AND key = ?`,
		agentID, key,
	).Scan(&csv)
	if err == sql.ErrNoRows {
		return []string{}, nil
	}
	if err != nil {
		return nil, err
	}
	out := make([]string, 0)
	for _, p := range strings.Split(csv, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out, nil
}

// SetLogLevelFilter persists the per-service ingest filter (CSV; empty = accept all).
func (r *AgentRepository) SetLogLevelFilter(agentID, key, csv string) error {
	_, err := DB.Exec(
		`UPDATE agent_services SET log_level_filter = ? WHERE agent_id = ? AND key = ?`,
		csv, agentID, key,
	)
	return err
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
SELECT s.agent_id, s.key, s.name, s.check_type, s.endpoint, s.runtime, s.healthy, s.seen, s.silenced,
       s.last_error, s.last_status, s.last_latency, s.updated_at, s.observed_at, a.name
FROM agent_services s
JOIN agents a ON a.id = s.agent_id
WHERE COALESCE(a.status,'active') = 'active'
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
			&f.AgentID, &f.Key, &f.Name, &f.CheckType, &f.Endpoint, &f.Runtime,
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
		latencyMs  float64
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
		b.sumLatency += rec.latencyMs
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
// Day grouping is done in Go, not SQL: recorded_at is stored as an RFC3339 string
// with a timezone offset, which SQLite's date() can't parse (returns NULL, so a
// SQL date() filter drops every row). Scanning time.Time and bucketing by local
// calendar date here matches how the bar chart reads days.
func (r *AgentRepository) GetServiceUptimeByDay(agentID, key string, days int) ([]models.ServiceUptimeDay, error) {
	since := time.Now().AddDate(0, 0, -days)
	return uptimeByDay(`
SELECT healthy, recorded_at
FROM agent_service_history
WHERE agent_id = ? AND key = ? AND recorded_at >= ?
ORDER BY recorded_at`,
		agentID, key, since)
}

// GetAgentUptimeByDay rolls daily uptime up across every service of one agent
// (project dashboard: 30-day uptime KPI + 90-day calendar).
func (r *AgentRepository) GetAgentUptimeByDay(agentID string, days int) ([]models.ServiceUptimeDay, error) {
	since := time.Now().AddDate(0, 0, -days)
	return uptimeByDay(`
SELECT healthy, recorded_at
FROM agent_service_history
WHERE agent_id = ? AND recorded_at >= ?
ORDER BY recorded_at`,
		agentID, since)
}

func uptimeByDay(query string, args ...interface{}) ([]models.ServiceUptimeDay, error) {
	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type acc struct {
		healthy int
		total   int
	}
	byDay := make(map[string]*acc)
	order := make([]string, 0)
	for rows.Next() {
		var healthy int
		var recordedAt time.Time
		if err := rows.Scan(&healthy, &recordedAt); err != nil {
			return nil, err
		}
		day := recordedAt.Format("2006-01-02")
		a, ok := byDay[day]
		if !ok {
			a = &acc{}
			byDay[day] = a
			order = append(order, day)
		}
		a.total++
		a.healthy += healthy
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	out := make([]models.ServiceUptimeDay, 0, len(order))
	for _, day := range order {
		a := byDay[day]
		d := models.ServiceUptimeDay{Date: day, HealthyChecks: a.healthy, TotalChecks: a.total}
		if a.total > 0 {
			d.UptimePct = float64(a.healthy) * 100.0 / float64(a.total)
		}
		out = append(out, d)
	}
	return out, nil
}

// GetAgentIncidents derives unhealthy episodes per service from
// agent_service_history: a run of healthy=0 checks is one incident, closed by
// the first healthy check after it. Newest first, capped at limit.
func (r *AgentRepository) GetAgentIncidents(agentID string, days, limit int) ([]models.AgentIncident, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	since := time.Now().AddDate(0, 0, -days)
	rows, err := DB.Query(`
SELECT h.key, COALESCE(s.name, h.key), h.healthy, h.recorded_at
FROM agent_service_history h
LEFT JOIN agent_services s ON s.agent_id = h.agent_id AND s.key = h.key
WHERE h.agent_id = ? AND h.recorded_at >= ?
ORDER BY h.key, h.recorded_at`,
		agentID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	incidents := make([]models.AgentIncident, 0)
	var open *models.AgentIncident
	prevKey := ""
	for rows.Next() {
		var key, name string
		var healthy int
		var recordedAt time.Time
		if err := rows.Scan(&key, &name, &healthy, &recordedAt); err != nil {
			return nil, err
		}
		if key != prevKey {
			// key boundary: an episode still open for the previous key stays active
			if open != nil {
				incidents = append(incidents, *open)
				open = nil
			}
			prevKey = key
		}
		switch {
		case healthy == 0 && open == nil:
			open = &models.AgentIncident{Key: key, ServiceName: name, StartedAt: recordedAt, Active: true}
		case healthy == 1 && open != nil:
			ended := recordedAt
			open.EndedAt = &ended
			open.DurationSec = int64(ended.Sub(open.StartedAt).Seconds())
			open.Active = false
			incidents = append(incidents, *open)
			open = nil
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if open != nil {
		incidents = append(incidents, *open)
	}
	now := time.Now()
	for i := range incidents {
		if incidents[i].Active {
			incidents[i].DurationSec = int64(now.Sub(incidents[i].StartedAt).Seconds())
		}
	}
	sort.Slice(incidents, func(i, j int) bool { return incidents[i].StartedAt.After(incidents[j].StartedAt) })
	if len(incidents) > limit {
		incidents = incidents[:limit]
	}
	return incidents, nil
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
