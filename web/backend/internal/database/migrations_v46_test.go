package database

import (
	"database/sql"
	"testing"
)

func TestMigrateV46AddsDirectTelemetryTablesWithoutChangingExistingIdentities(t *testing.T) {
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
		`PRAGMA foreign_keys = ON`,
		`CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL)`,
		`CREATE TABLE agents (id TEXT PRIMARY KEY, api_key_hash TEXT NOT NULL)`,
		`INSERT INTO projects (id, name) VALUES ('project-1', 'Existing project')`,
		`INSERT INTO agents (id, api_key_hash) VALUES ('agent-1', 'agent-hash')`,
	} {
		if _, err := DB.Exec(statement); err != nil {
			t.Fatalf("seed pre-v46 fixture: %v", err)
		}
	}

	if err := migrateV46(); err != nil {
		t.Fatalf("migrateV46: %v", err)
	}
	// Re-running migrations is part of startup behavior and must remain safe.
	if err := migrateV46(); err != nil {
		t.Fatalf("migrateV46 second run: %v", err)
	}

	var agentCount int
	if err := DB.QueryRow(`SELECT COUNT(*) FROM agents`).Scan(&agentCount); err != nil {
		t.Fatalf("count existing agents: %v", err)
	}
	if agentCount != 1 {
		t.Fatalf("existing agent count = %d, want 1", agentCount)
	}

	if _, err := DB.Exec(`
		INSERT INTO observed_services (id, name, project_id, created_at, updated_at)
		VALUES ('service-1', 'Checkout API', 'project-1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`); err != nil {
		t.Fatalf("insert observed service: %v", err)
	}
	if _, err := DB.Exec(`
		INSERT INTO direct_telemetry_connections (
			observed_service_id, api_key_hash, api_key_masked, signals,
			is_active, created_at, updated_at
		) VALUES ('service-1', 'direct-hash', 'evup_****abcd', '["logs"]', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`); err != nil {
		t.Fatalf("insert direct telemetry connection: %v", err)
	}

	var signals string
	if err := DB.QueryRow(`
		SELECT signals
		FROM direct_telemetry_connections
		WHERE observed_service_id = 'service-1'
	`).Scan(&signals); err != nil {
		t.Fatalf("read direct telemetry signals: %v", err)
	}
	if signals != `["logs"]` {
		t.Fatalf("signals = %q, want [\"logs\"]", signals)
	}
}
