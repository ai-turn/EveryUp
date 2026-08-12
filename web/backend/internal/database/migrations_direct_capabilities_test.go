package database

import (
	"database/sql"
	"testing"
)

func TestDirectCapabilityMigrationsPreserveExistingMonitoringFixtures(t *testing.T) {
	originalDB := DB
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	DB = db
	t.Cleanup(func() {
		DB = originalDB
		db.Close()
	})

	statements := []string{
		`PRAGMA foreign_keys = ON`,
		`CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL)`,
		`CREATE TABLE agents (id TEXT PRIMARY KEY, name TEXT NOT NULL, api_key_hash TEXT NOT NULL, project_id TEXT)`,
		`CREATE TABLE services (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, api_key_hash TEXT, project_id TEXT)`,
		`CREATE TABLE alert_rules (id TEXT PRIMARY KEY, name TEXT NOT NULL)`,
		`CREATE TABLE logs (id INTEGER PRIMARY KEY, service_id TEXT NOT NULL, message TEXT NOT NULL)`,
		`CREATE TABLE otel_metrics (id INTEGER PRIMARY KEY, service_name TEXT NOT NULL, value REAL NOT NULL)`,
		`CREATE TABLE system_metrics (id INTEGER PRIMARY KEY, host_id TEXT NOT NULL, cpu_usage REAL NOT NULL)`,
		`CREATE TABLE spans (id INTEGER PRIMARY KEY, service_name TEXT NOT NULL, span_id TEXT NOT NULL)`,
		`CREATE TABLE api_requests (id INTEGER PRIMARY KEY, service_id TEXT NOT NULL, path TEXT NOT NULL)`,
		`CREATE TABLE hosts (id TEXT PRIMARY KEY, name TEXT NOT NULL)`,
		`INSERT INTO projects VALUES ('project-1', 'Production')`,
		`INSERT INTO agents VALUES ('agent-1', 'Existing Agent', 'agent-hash', 'project-1')`,
		`INSERT INTO services VALUES ('uptime-1', 'Public API', 'http', NULL, 'project-1')`,
		`INSERT INTO services VALUES ('legacy-1', 'Legacy logs', 'log', 'legacy-hash', NULL)`,
		`INSERT INTO alert_rules VALUES ('rule-1', 'Existing alert')`,
		`INSERT INTO logs VALUES (1, 'legacy-1', 'existing log')`,
		`INSERT INTO otel_metrics VALUES (1, 'api', 42)`,
		`INSERT INTO system_metrics VALUES (1, 'host-1', 25)`,
		`INSERT INTO spans VALUES (1, 'api', 'span-1')`,
		`INSERT INTO api_requests VALUES (1, 'legacy-1', '/health')`,
		`INSERT INTO hosts VALUES ('host-1', 'Existing host')`,
	}
	for _, statement := range statements {
		if _, err := DB.Exec(statement); err != nil {
			t.Fatalf("seed pre-direct-capability fixture: %v\n%s", err, statement)
		}
	}

	for version, migration := range []func() error{migrateV46, migrateV47, migrateV48, migrateV49} {
		if err := migration(); err != nil {
			t.Fatalf("direct capability migration v%d: %v", version+46, err)
		}
	}

	expectedCounts := map[string]int{
		"projects": 1, "agents": 1, "services": 2, "alert_rules": 1,
		"logs": 1, "otel_metrics": 1, "system_metrics": 1, "spans": 1,
		"api_requests": 1, "hosts": 1,
	}
	for table, expected := range expectedCounts {
		var count int
		if err := DB.QueryRow("SELECT COUNT(*) FROM " + table).Scan(&count); err != nil {
			t.Fatalf("count %s: %v", table, err)
		}
		if count != expected {
			t.Fatalf("%s rows after migrations = %d, want %d", table, count, expected)
		}
	}

	var agentProject, uptimeProject, legacyHash, logMessage, requestPath, hostName string
	if err := DB.QueryRow(`SELECT project_id FROM agents WHERE id = 'agent-1'`).Scan(&agentProject); err != nil {
		t.Fatal(err)
	}
	if err := DB.QueryRow(`SELECT project_id FROM services WHERE id = 'uptime-1'`).Scan(&uptimeProject); err != nil {
		t.Fatal(err)
	}
	if err := DB.QueryRow(`SELECT api_key_hash FROM services WHERE id = 'legacy-1'`).Scan(&legacyHash); err != nil {
		t.Fatal(err)
	}
	if err := DB.QueryRow(`SELECT message FROM logs WHERE id = 1`).Scan(&logMessage); err != nil {
		t.Fatal(err)
	}
	if err := DB.QueryRow(`SELECT path FROM api_requests WHERE id = 1`).Scan(&requestPath); err != nil {
		t.Fatal(err)
	}
	if err := DB.QueryRow(`SELECT name FROM hosts WHERE id = 'host-1'`).Scan(&hostName); err != nil {
		t.Fatal(err)
	}
	if agentProject != "project-1" || uptimeProject != "project-1" || legacyHash != "legacy-hash" ||
		logMessage != "existing log" || requestPath != "/health" || hostName != "Existing host" {
		t.Fatalf("existing fixture values changed: agentProject=%q uptimeProject=%q legacyHash=%q log=%q path=%q host=%q",
			agentProject, uptimeProject, legacyHash, logMessage, requestPath, hostName)
	}
}
