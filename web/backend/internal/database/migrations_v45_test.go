package database

import (
	"database/sql"
	"testing"
)

func TestMigrateV45KeepsExistingMonitoringDataUnassigned(t *testing.T) {
	originalDB := DB
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	DB = db
	t.Cleanup(func() {
		DB = originalDB
		db.Close()
	})

	for _, statement := range []string{
		`CREATE TABLE agents (id TEXT PRIMARY KEY, status TEXT NOT NULL)`,
		`CREATE TABLE services (id TEXT PRIMARY KEY)`,
		`CREATE TABLE agent_services (id TEXT PRIMARY KEY)`,
		`CREATE TABLE agent_service_history (id INTEGER PRIMARY KEY)`,
		`CREATE TABLE logs (id INTEGER PRIMARY KEY)`,
		`CREATE TABLE api_requests (id TEXT PRIMARY KEY)`,
		`CREATE TABLE otel_metrics (id INTEGER PRIMARY KEY)`,
		`CREATE TABLE spans (id TEXT PRIMARY KEY)`,
		`CREATE TABLE alert_rules (id TEXT PRIMARY KEY)`,
		`INSERT INTO agents (id, status) VALUES ('disabled-agent', 'disabled')`,
		`INSERT INTO services (id) VALUES ('existing-monitor')`,
		`INSERT INTO agent_services (id) VALUES ('agent-service')`,
		`INSERT INTO agent_service_history (id) VALUES (1)`,
		`INSERT INTO logs (id) VALUES (1)`,
		`INSERT INTO api_requests (id) VALUES ('request')`,
		`INSERT INTO otel_metrics (id) VALUES (1)`,
		`INSERT INTO spans (id) VALUES ('span')`,
		`INSERT INTO alert_rules (id) VALUES ('rule')`,
	} {
		if _, err := DB.Exec(statement); err != nil {
			t.Fatalf("seed legacy fixture: %v", err)
		}
	}

	if err := migrateV45(); err != nil {
		t.Fatalf("migrateV45: %v", err)
	}

	for _, table := range []string{
		"agents", "services", "agent_services", "agent_service_history", "logs",
		"api_requests", "otel_metrics", "spans", "alert_rules",
	} {
		var count int
		if err := DB.QueryRow("SELECT COUNT(*) FROM " + table).Scan(&count); err != nil {
			t.Fatalf("count %s: %v", table, err)
		}
		if count != 1 {
			t.Errorf("%s count = %d, want 1", table, count)
		}
	}

	for _, table := range []string{"agents", "services"} {
		var projectID sql.NullString
		if err := DB.QueryRow("SELECT project_id FROM " + table).Scan(&projectID); err != nil {
			t.Fatalf("read %s project_id: %v", table, err)
		}
		if projectID.Valid {
			t.Errorf("%s project_id = %q, want NULL for existing data", table, projectID.String)
		}
	}
}
