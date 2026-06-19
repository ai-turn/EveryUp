package database_test

import (
	"testing"

	"github.com/aiturn/everyup/internal/database"
)

func openTestDB(t *testing.T) {
	t.Helper()
	if err := database.Connect(":memory:"); err != nil {
		t.Fatalf("Connect :memory: failed: %v", err)
	}
	t.Cleanup(func() { database.Close() })
}

func TestMigrateV20_ApiRequestsTableExists(t *testing.T) {
	openTestDB(t)

	var name string
	err := database.DB.QueryRow(
		`SELECT name FROM sqlite_master WHERE type='table' AND name='api_requests'`,
	).Scan(&name)
	if err != nil {
		t.Fatalf("api_requests table not found: %v", err)
	}
	// Scan succeeded, so name is guaranteed to be "api_requests" — no further check needed.
}

// TestMigrateV20_Idempotent verifies that running migrateV20 a second time on an
// already-migrated database does not produce an error.  The CREATE TABLE uses
// IF NOT EXISTS and every ALTER TABLE statement is guarded by the
// "duplicate column" check, so a second invocation must be a no-op.
func TestMigrateV20_Idempotent(t *testing.T) {
	openTestDB(t) // Connect already ran all migrations, including migrateV20.

	// Run migrateV20 again on the same open connection.
	if err := database.MigrateV20ForTest(); err != nil {
		t.Fatalf("second run of migrateV20 returned error: %v", err)
	}

	// Confirm that api_capture_mode appears exactly once — not duplicated.
	rows, err := database.DB.Query("PRAGMA table_info(services)")
	if err != nil {
		t.Fatalf("PRAGMA table_info(services) failed: %v", err)
	}
	count := 0
	for rows.Next() {
		var cid int
		var colName, colType string
		var notNull, pk int
		var dflt interface{}
		if err := rows.Scan(&cid, &colName, &colType, &notNull, &dflt, &pk); err != nil {
			rows.Close()
			t.Fatalf("scan failed: %v", err)
		}
		if colName == "api_capture_mode" {
			count++
		}
	}
	rows.Close()
	if count != 1 {
		t.Errorf("api_capture_mode appears %d time(s) in services table, want exactly 1", count)
	}
}

// TestMigrateV26_DropsApiCaptureColumns confirms api_capture_mode and
// api_sample_rate are absent after the full migration chain runs. They were
// added by migrateV20 and dropped by migrateV26 once the OTel-only refactor
// removed every reader.
func TestMigrateV26_DropsApiCaptureColumns(t *testing.T) {
	openTestDB(t)

	rows, err := database.DB.Query("PRAGMA table_info(services)")
	if err != nil {
		t.Fatalf("PRAGMA table_info(services) failed: %v", err)
	}
	cols := make(map[string]bool)
	for rows.Next() {
		var cid int
		var colName, colType string
		var notNull, pk int
		var dflt interface{}
		if err := rows.Scan(&cid, &colName, &colType, &notNull, &dflt, &pk); err != nil {
			rows.Close()
			t.Fatalf("scan failed: %v", err)
		}
		cols[colName] = true
	}
	rows.Close()

	for _, c := range []string{"api_capture_mode", "api_sample_rate"} {
		if cols[c] {
			t.Errorf("services table still has column %q after migrateV26", c)
		}
	}
}

func TestMigrateV20_ApiRequestsIndexesExist(t *testing.T) {
	openTestDB(t)

	rows, err := database.DB.Query(
		`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='api_requests'`,
	)
	if err != nil {
		t.Fatalf("sqlite_master query failed: %v", err)
	}
	indexes := make(map[string]bool)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			rows.Close()
			t.Fatalf("scan failed: %v", err)
		}
		indexes[name] = true
	}
	rows.Close()

	want := []string{
		"idx_api_requests_service_time",
		"idx_api_requests_service_status",
		"idx_api_requests_service_error",
		"idx_api_requests_request_id",
	}
	for _, idx := range want {
		if !indexes[idx] {
			t.Errorf("api_requests missing index %q", idx)
		}
	}
}
