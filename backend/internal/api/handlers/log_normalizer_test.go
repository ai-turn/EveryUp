package handlers

import (
	"testing"

	"github.com/aiturn/everyup/internal/models"
)

func TestNormalizeRawLogsDefaultsPlainTextDockerStdoutToInfo(t *testing.T) {
	entries, err := normalizeRawLogs([]byte(`{"log":"server started\n","stream":"stdout","time":"2026-04-28T12:00:00Z"}`))
	if err != nil {
		t.Fatalf("normalizeRawLogs() error = %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("len(entries) = %d, want 1", len(entries))
	}
	if entries[0].Level != models.LogLevelInfo {
		t.Fatalf("level = %q, want %q", entries[0].Level, models.LogLevelInfo)
	}
}

func TestNormalizeRawLogsMapsDockerStderrToError(t *testing.T) {
	entries, err := normalizeRawLogs([]byte(`{"log":"panic: failed\n","stream":"stderr","time":"2026-04-28T12:00:00Z"}`))
	if err != nil {
		t.Fatalf("normalizeRawLogs() error = %v", err)
	}
	if entries[0].Level != models.LogLevelError {
		t.Fatalf("level = %q, want %q", entries[0].Level, models.LogLevelError)
	}
}

func TestNormalizeRawLogsInfersLevelFromMessagePrefix(t *testing.T) {
	entries, err := normalizeRawLogs([]byte(`{"message":"WARN cache miss"}`))
	if err != nil {
		t.Fatalf("normalizeRawLogs() error = %v", err)
	}
	if entries[0].Level != models.LogLevelWarn {
		t.Fatalf("level = %q, want %q", entries[0].Level, models.LogLevelWarn)
	}
}

func TestNormalizeFormEncodedDefaultsMissingLevelToInfo(t *testing.T) {
	entry, err := normalizeFormEncoded("msg=hello")
	if err != nil {
		t.Fatalf("normalizeFormEncoded() error = %v", err)
	}
	if entry.Level != models.LogLevelInfo {
		t.Fatalf("level = %q, want %q", entry.Level, models.LogLevelInfo)
	}
}
