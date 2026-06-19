package memory

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

type Incident struct {
	ID          int64
	StartedAt   time.Time
	ResolvedAt  time.Time
	ServiceName string
	TargetKey   string
	Severity    string
	Status      string
	Message     string
	Fingerprint string
	Metadata    map[string]interface{}
}

type Command struct {
	Time    time.Time
	ChatID  string
	Command string
	Message string
}

type SimilarIncident struct {
	Incident Incident
	Score    int
}

func Open(path string) (*Store, error) {
	if strings.TrimSpace(path) == "" {
		return nil, fmt.Errorf("memory database path is required")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	store := &Store{db: db}
	if err := store.Migrate(context.Background()); err != nil {
		_ = db.Close()
		return nil, err
	}
	return store, nil
}

func (s *Store) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

func (s *Store) Migrate(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS incidents (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	started_at TEXT NOT NULL,
	resolved_at TEXT,
	service_name TEXT NOT NULL,
	target_key TEXT NOT NULL,
	severity TEXT NOT NULL,
	status TEXT NOT NULL,
	message TEXT NOT NULL,
	fingerprint TEXT NOT NULL,
	metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_incidents_service_started ON incidents(service_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_target_status ON incidents(target_key, status);
CREATE INDEX IF NOT EXISTS idx_incidents_fingerprint ON incidents(fingerprint);

CREATE TABLE IF NOT EXISTS command_history (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	time TEXT NOT NULL,
	chat_id TEXT NOT NULL,
	command TEXT NOT NULL,
	message TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_command_history_time ON command_history(time DESC);
`)
	return err
}

func (s *Store) RecordAlert(ctx context.Context, incident Incident) error {
	if s == nil {
		return nil
	}
	now := incident.StartedAt
	if now.IsZero() {
		now = time.Now()
	}
	metadata, err := json.Marshal(incident.Metadata)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `
INSERT INTO incidents(started_at, service_name, target_key, severity, status, message, fingerprint, metadata_json)
VALUES (?, ?, ?, ?, 'open', ?, ?, ?)`,
		now.UTC().Format(time.RFC3339Nano),
		incident.ServiceName,
		incident.TargetKey,
		valueOrDefault(incident.Severity, "critical"),
		incident.Message,
		valueOrDefault(incident.Fingerprint, Fingerprint(incident.ServiceName, incident.TargetKey, incident.Message)),
		string(metadata),
	)
	return err
}

func (s *Store) ResolveLatest(ctx context.Context, serviceName, targetKey string, resolvedAt time.Time) error {
	if s == nil {
		return nil
	}
	if resolvedAt.IsZero() {
		resolvedAt = time.Now()
	}
	_, err := s.db.ExecContext(ctx, `
UPDATE incidents
SET status = 'resolved', resolved_at = ?
WHERE id = (
	SELECT id FROM incidents
	WHERE target_key = ? AND status = 'open'
	ORDER BY started_at DESC
	LIMIT 1
)`,
		resolvedAt.UTC().Format(time.RFC3339Nano),
		targetKey,
	)
	if err != nil {
		return err
	}
	if targetKey != "" {
		return nil
	}
	_, err = s.db.ExecContext(ctx, `
UPDATE incidents
SET status = 'resolved', resolved_at = ?
WHERE id = (
	SELECT id FROM incidents
	WHERE service_name = ? AND status = 'open'
	ORDER BY started_at DESC
	LIMIT 1
)`,
		resolvedAt.UTC().Format(time.RFC3339Nano),
		serviceName,
	)
	return err
}

func (s *Store) RecordCommand(ctx context.Context, command Command) error {
	if s == nil {
		return nil
	}
	if command.Time.IsZero() {
		command.Time = time.Now()
	}
	_, err := s.db.ExecContext(ctx, `
INSERT INTO command_history(time, chat_id, command, message)
VALUES (?, ?, ?, ?)`,
		command.Time.UTC().Format(time.RFC3339Nano),
		command.ChatID,
		command.Command,
		command.Message,
	)
	return err
}

func (s *Store) Similar(ctx context.Context, query Incident, limit int) ([]SimilarIncident, error) {
	if s == nil {
		return nil, nil
	}
	if limit <= 0 {
		limit = 5
	}
	rows, err := s.db.QueryContext(ctx, `
SELECT id, started_at, COALESCE(resolved_at, ''), service_name, target_key, severity, status, message, fingerprint, metadata_json
FROM incidents
WHERE service_name = ? OR target_key = ? OR fingerprint = ?
ORDER BY started_at DESC
LIMIT 100`,
		query.ServiceName,
		query.TargetKey,
		Fingerprint(query.ServiceName, query.TargetKey, query.Message),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	candidates := make([]SimilarIncident, 0)
	for rows.Next() {
		incident, err := scanIncident(rows)
		if err != nil {
			return nil, err
		}
		score := similarityScore(query, incident)
		if score == 0 {
			continue
		}
		candidates = append(candidates, SimilarIncident{Incident: incident, Score: score})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].Score == candidates[j].Score {
			return candidates[i].Incident.StartedAt.After(candidates[j].Incident.StartedAt)
		}
		return candidates[i].Score > candidates[j].Score
	})
	if len(candidates) > limit {
		candidates = candidates[:limit]
	}
	return candidates, nil
}

func (s *Store) LatestForService(ctx context.Context, serviceName, targetKey string) (Incident, bool, error) {
	if s == nil {
		return Incident{}, false, nil
	}
	row := s.db.QueryRowContext(ctx, `
SELECT id, started_at, COALESCE(resolved_at, ''), service_name, target_key, severity, status, message, fingerprint, metadata_json
FROM incidents
WHERE service_name = ? OR target_key = ?
ORDER BY started_at DESC
LIMIT 1`, serviceName, targetKey)
	incident, err := scanIncident(row)
	if err == sql.ErrNoRows {
		return Incident{}, false, nil
	}
	if err != nil {
		return Incident{}, false, err
	}
	return incident, true, nil
}

func Fingerprint(serviceName, targetKey, message string) string {
	parts := []string{
		strings.ToLower(strings.TrimSpace(serviceName)),
		strings.ToLower(strings.TrimSpace(targetKey)),
	}
	for _, token := range tokens(message) {
		if isNoisyToken(token) {
			continue
		}
		parts = append(parts, token)
		if len(parts) >= 8 {
			break
		}
	}
	return strings.Join(parts, "|")
}

func scanIncident(scanner interface {
	Scan(dest ...interface{}) error
}) (Incident, error) {
	var incident Incident
	var startedAt string
	var resolvedAt string
	var metadataText string
	err := scanner.Scan(
		&incident.ID,
		&startedAt,
		&resolvedAt,
		&incident.ServiceName,
		&incident.TargetKey,
		&incident.Severity,
		&incident.Status,
		&incident.Message,
		&incident.Fingerprint,
		&metadataText,
	)
	if err != nil {
		return Incident{}, err
	}
	incident.StartedAt, _ = time.Parse(time.RFC3339Nano, startedAt)
	if resolvedAt != "" {
		incident.ResolvedAt, _ = time.Parse(time.RFC3339Nano, resolvedAt)
	}
	if metadataText != "" {
		_ = json.Unmarshal([]byte(metadataText), &incident.Metadata)
	}
	if incident.Metadata == nil {
		incident.Metadata = map[string]interface{}{}
	}
	return incident, nil
}

func similarityScore(query Incident, candidate Incident) int {
	score := 0
	if query.ServiceName != "" && strings.EqualFold(query.ServiceName, candidate.ServiceName) {
		score += 3
	}
	if query.TargetKey != "" && query.TargetKey == candidate.TargetKey {
		score += 3
	}
	if query.Fingerprint != "" && query.Fingerprint == candidate.Fingerprint {
		score += 4
	}
	queryTokens := tokenSet(query.Message)
	for token := range tokenSet(candidate.Message) {
		if queryTokens[token] {
			score++
		}
	}
	return score
}

func tokenSet(value string) map[string]bool {
	set := make(map[string]bool)
	for _, token := range tokens(value) {
		if !isNoisyToken(token) {
			set[token] = true
		}
	}
	return set
}

func tokens(value string) []string {
	value = strings.ToLower(value)
	replacer := strings.NewReplacer("\n", " ", "\t", " ", ":", " ", "/", " ", "\\", " ", ".", " ", ",", " ", "(", " ", ")", " ")
	value = replacer.Replace(value)
	parts := strings.Fields(value)
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.Trim(part, `"'[]{}<>`)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

func isNoisyToken(token string) bool {
	if len(token) < 3 {
		return true
	}
	switch token {
	case "http", "https", "localhost", "service", "failed", "returned":
		return true
	default:
		return false
	}
}

func valueOrDefault(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}
