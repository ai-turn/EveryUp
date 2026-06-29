package database_test

import (
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

func TestSpanRetentionDeletesOlderThanCutoff(t *testing.T) {
	openTestDB(t)
	repo := database.NewSpanRepository()
	now := time.Now()
	old := now.Add(-8 * 24 * time.Hour)
	recent := now.Add(-time.Hour)

	_, err := repo.CreateBatch([]models.Span{
		{TraceID: "trace-old", SpanID: "span-old", Name: "old", Kind: "SERVER", CreatedAt: old},
		{TraceID: "trace-recent", SpanID: "span-recent", Name: "recent", Kind: "SERVER", CreatedAt: recent},
	})
	if err != nil {
		t.Fatalf("CreateBatch: %v", err)
	}

	deleted, err := repo.DeleteOlderThan(now.Add(-7 * 24 * time.Hour))
	if err != nil {
		t.Fatalf("DeleteOlderThan: %v", err)
	}
	if deleted != 1 {
		t.Fatalf("deleted = %d, want 1", deleted)
	}

	oldSpans, err := repo.GetByTraceID("trace-old")
	if err != nil {
		t.Fatalf("GetByTraceID old: %v", err)
	}
	if len(oldSpans) != 0 {
		t.Fatalf("old spans still present: %+v", oldSpans)
	}
	recentSpans, err := repo.GetByTraceID("trace-recent")
	if err != nil {
		t.Fatalf("GetByTraceID recent: %v", err)
	}
	if len(recentSpans) != 1 {
		t.Fatalf("recent spans len = %d, want 1", len(recentSpans))
	}
}
