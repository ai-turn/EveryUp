package database

import (
	"database/sql"
	"testing"
)

func TestMigrateV47AddsDirectLogFilterAndPreservesConnections(t *testing.T) {
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

	if _, err := DB.Exec(`CREATE TABLE direct_telemetry_connections (
		observed_service_id TEXT PRIMARY KEY,
		api_key_hash TEXT NOT NULL,
		api_key_masked TEXT NOT NULL,
		signals TEXT NOT NULL,
		is_active INTEGER NOT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	)`); err != nil {
		t.Fatal(err)
	}
	if _, err := DB.Exec(`INSERT INTO direct_telemetry_connections
		(observed_service_id, api_key_hash, api_key_masked, signals, is_active, created_at, updated_at)
		VALUES ('service-1', 'hash', 'masked', '["logs"]', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`); err != nil {
		t.Fatal(err)
	}

	if err := migrateV47(); err != nil {
		t.Fatalf("migrateV47: %v", err)
	}
	if err := migrateV47(); err != nil {
		t.Fatalf("migrateV47 second run: %v", err)
	}

	var filter string
	if err := DB.QueryRow(`SELECT log_level_filter FROM direct_telemetry_connections
		WHERE observed_service_id = 'service-1'`).Scan(&filter); err != nil {
		t.Fatal(err)
	}
	if filter != "[]" {
		t.Fatalf("log_level_filter = %q, want []", filter)
	}
}
