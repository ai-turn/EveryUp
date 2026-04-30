package handlers

import (
	"strings"
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

// --- DEBUG / TRACE preservation tests ---

func TestMapGenericLevelPreservesDebugAndTrace(t *testing.T) {
	cases := []struct {
		in   string
		want models.LogLevel
	}{
		{"DEBUG", models.LogLevelDebug},
		{"debug", models.LogLevelDebug},
		{"TRACE", models.LogLevelTrace},
		{"trace", models.LogLevelTrace},
		{"VERBOSE", models.LogLevelTrace},
		{"INFO", models.LogLevelInfo},
		{"INFORMATION", models.LogLevelInfo},
	}
	for _, c := range cases {
		if got := mapGenericLevel(c.in); got != c.want {
			t.Errorf("mapGenericLevel(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestMapSerilogLevelPreservesDebugAndVerbose(t *testing.T) {
	cases := []struct {
		in   string
		want models.LogLevel
	}{
		{"Debug", models.LogLevelDebug},
		{"debug", models.LogLevelDebug},
		{"Verbose", models.LogLevelTrace},
		{"verbose", models.LogLevelTrace},
		{"Information", models.LogLevelInfo},
	}
	for _, c := range cases {
		if got := mapSerilogLevel(c.in); got != c.want {
			t.Errorf("mapSerilogLevel(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestInferLevelFromMessagePreservesDebugAndTrace(t *testing.T) {
	cases := []struct {
		in   string
		want models.LogLevel
	}{
		{"DEBUG sql executed", models.LogLevelDebug},
		{"[DEBUG] something", models.LogLevelDebug},
		{"TRACE entering method", models.LogLevelTrace},
		{"VERBOSE detail dump", models.LogLevelTrace},
		{"INFO startup ok", models.LogLevelInfo},
		// Spring Boot / Logback default format — timestamp first, level token mid-line.
		{"2026-04-30 22:12:31.541 [DEBUG] 1 --- [http-nio] o.s.jdbc.core.JdbcTemplate : Executing", models.LogLevelDebug},
		{"2026-04-30 22:12:31.541 [ERROR] boom", models.LogLevelError},
		{"2026-04-30 22:12:31.541 [WARN] slow query", models.LogLevelWarn},
		{"2026-04-30 22:12:31.541 [TRACE] entering method", models.LogLevelTrace},
	}
	for _, c := range cases {
		if got := inferLevelFromMessage(c.in); got != c.want {
			t.Errorf("inferLevelFromMessage(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

// TestInferLevelFromMessage_AdversarialBracketed covers cases where naive
// substring matching would mislabel: stray "[ERROR]" in body, thread-name
// brackets, non-level all-caps brackets.
func TestInferLevelFromMessage_AdversarialBracketed(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want models.LogLevel
	}{
		{
			name: "INFO line that mentions [ERROR] in body",
			in:   "2026-04-30 22:12:31 [INFO] Caught [ERROR] response from upstream service",
			want: models.LogLevelInfo,
		},
		{
			name: "WARN line that mentions [ERROR] later",
			in:   "2026-04-30 [WARN] retrying after [ERROR]",
			want: models.LogLevelWarn,
		},
		{
			name: "Thread-name bracket comes first then real DEBUG",
			in:   "1 --- [http-nio] [DEBUG] o.s.jdbc started",
			want: models.LogLevelDebug,
		},
		{
			name: "Non-level all-caps bracket is skipped",
			in:   "Started [HEALTHCHECK] task",
			want: "", // no known level → empty (caller falls back to inferLevelFromStream / default)
		},
		{
			name: "Underscore variant is not a known level",
			in:   "[ERROR_HANDLER] controller invoked",
			want: "", // ERROR_HANDLER is not the keyword "ERROR"
		},
		{
			name: "Bracketed level after 200-char head is ignored (long stack trace)",
			in:   strings.Repeat("a ", 110) + " [ERROR] way back",
			want: "",
		},
	}
	for _, c := range cases {
		if got := inferLevelFromMessage(c.in); got != c.want {
			t.Errorf("%s: inferLevelFromMessage(...) = %q, want %q", c.name, got, c.want)
		}
	}
}

func TestNormalizeRawLogsPreservesDebugFromWinston(t *testing.T) {
	entries, err := normalizeRawLogs([]byte(`{"level":"debug","message":"sql query"}`))
	if err != nil {
		t.Fatalf("normalizeRawLogs() error = %v", err)
	}
	if entries[0].Level != models.LogLevelDebug {
		t.Fatalf("level = %q, want %q", entries[0].Level, models.LogLevelDebug)
	}
}

func TestNormalizeRawLogsPreservesTraceFromLogstash(t *testing.T) {
	entries, err := normalizeRawLogs([]byte(`{"@timestamp":"2026-04-29T00:00:00Z","level":"TRACE","message":"deep trace"}`))
	if err != nil {
		t.Fatalf("normalizeRawLogs() error = %v", err)
	}
	if entries[0].Level != models.LogLevelTrace {
		t.Fatalf("level = %q, want %q", entries[0].Level, models.LogLevelTrace)
	}
}

func TestNormalizeRawLogsPreservesDebugFromSerilog(t *testing.T) {
	entries, err := normalizeRawLogs([]byte(`{"events":[{"@t":"2026-04-29T00:00:00Z","@mt":"sql","@l":"Debug"}]}`))
	if err != nil {
		t.Fatalf("normalizeRawLogs() error = %v", err)
	}
	if entries[0].Level != models.LogLevelDebug {
		t.Fatalf("level = %q, want %q", entries[0].Level, models.LogLevelDebug)
	}
}

func TestNormalizeFormEncodedPreservesDebug(t *testing.T) {
	entry, err := normalizeFormEncoded("levelname=DEBUG&msg=sql")
	if err != nil {
		t.Fatalf("normalizeFormEncoded() error = %v", err)
	}
	if entry.Level != models.LogLevelDebug {
		t.Fatalf("level = %q, want %q", entry.Level, models.LogLevelDebug)
	}
}
