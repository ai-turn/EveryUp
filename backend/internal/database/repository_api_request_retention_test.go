package database_test

import (
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// TestApiRequestRetention_14Days verifies that DeleteOlderThan correctly removes
// rows older than the 14-day cutoff while preserving recent rows.
func TestApiRequestRetention_14Days(t *testing.T) {
	openTestDB(t)
	makeTestService(t, "svc-retention")

	repo := database.NewApiRequestRepository()

	now := time.Now()
	old := now.Add(-15 * 24 * time.Hour) // 15 days ago — must be deleted
	recent := now.Add(-1 * 24 * time.Hour) // 1 day ago  — must survive

	reqs := []models.ApiRequest{
		makeTestRequest("svc-retention", "GET", "/old-endpoint", 200, false, old),
		makeTestRequest("svc-retention", "GET", "/recent-endpoint", 200, false, recent),
	}
	if _, err := repo.CreateBatch(reqs); err != nil {
		t.Fatalf("CreateBatch: %v", err)
	}

	// Apply 14-day cutoff (same formula as the cleanup worker).
	cutoff := now.Add(-14 * 24 * time.Hour)
	affected, err := repo.DeleteOlderThan(cutoff)
	if err != nil {
		t.Fatalf("DeleteOlderThan: %v", err)
	}
	if affected != 1 {
		t.Errorf("DeleteOlderThan affected = %d, want 1 (only the 15-day-old row)", affected)
	}

	// Verify the 15-day-old row is gone and the 1-day-old row remains.
	items, total, err := repo.List(&models.ApiRequestFilter{ServiceID: "svc-retention"})
	if err != nil {
		t.Fatalf("List after retention cleanup: %v", err)
	}
	if total != 1 {
		t.Errorf("total after cleanup = %d, want 1", total)
	}
	if len(items) == 1 && items[0].Path != "/recent-endpoint" {
		t.Errorf("surviving row path = %q, want /recent-endpoint", items[0].Path)
	}
}
