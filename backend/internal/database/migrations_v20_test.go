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
	if name != "api_requests" {
		t.Errorf("expected table name 'api_requests', got %q", name)
	}
}

func TestMigrateV20_ServicesCaptureColumnsExist(t *testing.T) {
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

	want := []string{
		"api_capture_mode",
		"api_sample_rate",
		"api_body_max_bytes",
		"api_masked_headers",
		"api_masked_body_fields",
	}
	for _, c := range want {
		if !cols[c] {
			t.Errorf("services table missing column %q", c)
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
