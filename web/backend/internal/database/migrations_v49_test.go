package database

import (
	"database/sql"
	"testing"
)

func TestMigrateV49AddsCollectorIdentityWithoutChangingExistingHosts(t *testing.T) {
	originalDB := DB
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	DB = db
	t.Cleanup(func() { DB = originalDB; db.Close() })

	if _, err := DB.Exec(`CREATE TABLE hosts (
		id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'local',
		ip TEXT NOT NULL DEFAULT '', port INTEGER DEFAULT 0, "group" TEXT NOT NULL DEFAULT '',
		is_active INTEGER DEFAULT 1, description TEXT DEFAULT '', last_error TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`); err != nil {
		t.Fatal(err)
	}
	if _, err := DB.Exec(`INSERT INTO hosts(id, name) VALUES ('local', 'Existing host')`); err != nil {
		t.Fatal(err)
	}

	if err := migrateV49(); err != nil {
		t.Fatalf("migrateV49: %v", err)
	}
	if err := migrateV49(); err != nil {
		t.Fatalf("migrateV49 second run: %v", err)
	}

	var name, collectorType, masked string
	if err := DB.QueryRow(`SELECT name, collector_type, api_key_masked FROM hosts WHERE id = 'local'`).Scan(&name, &collectorType, &masked); err != nil {
		t.Fatal(err)
	}
	if name != "Existing host" || collectorType != "" || masked != "" {
		t.Fatalf("existing host changed: name=%q collector=%q masked=%q", name, collectorType, masked)
	}
}
