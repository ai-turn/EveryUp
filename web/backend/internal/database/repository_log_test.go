package database_test

import (
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// Per-level bucketing + filter window for the logs-tab volume histogram.
func TestLogRepo_Histogram(t *testing.T) {
	openTestDB(t)

	repo := database.NewLogRepository()
	base := time.Now().Truncate(time.Hour)
	mk := func(level string, at time.Time) {
		t.Helper()
		if err := repo.Create(&models.Log{
			AgentID: "agent-x", ServiceName: "api", Level: models.LogLevel(level),
			Message: level + " msg", CreatedAt: at,
		}); err != nil {
			t.Fatalf("Create(%s): %v", level, err)
		}
	}
	// bucket 1 (base+0..9m): 2 error, 1 warn, 1 info · bucket 2 (base+10..19m): 1 debug
	mk("error", base.Add(1*time.Minute))
	mk("error", base.Add(2*time.Minute))
	mk("warn", base.Add(3*time.Minute))
	mk("info", base.Add(4*time.Minute))
	mk("debug", base.Add(11*time.Minute))
	// outside window / other agent — excluded
	mk("error", base.Add(-2*time.Hour))
	if err := repo.Create(&models.Log{
		AgentID: "agent-other", ServiceName: "api", Level: "error", Message: "foreign", CreatedAt: base.Add(1 * time.Minute),
	}); err != nil {
		t.Fatalf("Create foreign: %v", err)
	}

	buckets, err := repo.Histogram(models.LogFilter{
		AgentID: "agent-x", ServiceName: "api", From: base.Add(-time.Hour),
	}, 10)
	if err != nil {
		t.Fatalf("Histogram: %v", err)
	}
	if len(buckets) != 2 {
		t.Fatalf("buckets = %d (%+v), want 2", len(buckets), buckets)
	}
	b1, b2 := buckets[0], buckets[1]
	if b1.Error != 2 || b1.Warn != 1 || b1.Info != 1 || b1.Debug != 0 {
		t.Errorf("bucket1 = %+v, want error:2 warn:1 info:1", b1)
	}
	if b2.Debug != 1 || b2.Error != 0 {
		t.Errorf("bucket2 = %+v, want debug:1", b2)
	}

	// level filter narrows the histogram too
	only, err := repo.Histogram(models.LogFilter{AgentID: "agent-x", Level: "error", From: base.Add(-time.Hour)}, 10)
	if err != nil {
		t.Fatalf("Histogram(level): %v", err)
	}
	if len(only) != 1 || only[0].Error != 2 || only[0].Warn != 0 {
		t.Errorf("level-filtered = %+v, want one bucket with error:2", only)
	}
}
