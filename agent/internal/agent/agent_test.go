package agent

import (
	"testing"

	"github.com/aiturn/everyup/agent/internal/discovery"
	"github.com/aiturn/everyup/agent/internal/hostmetrics"
)

func TestMatchLogKeywordUsesNewestMatchingLine(t *testing.T) {
	keyword, line, ok := matchLogKeyword([]string{
		"2026-06-19T00:00:00Z ERROR old failure",
		"2026-06-19T00:01:00Z info ok",
		"2026-06-19T00:02:00Z panic latest failure",
	}, []string{"ERROR", "panic"})
	if !ok {
		t.Fatal("expected keyword match")
	}
	if keyword != "panic" || line != "2026-06-19T00:02:00Z panic latest failure" {
		t.Fatalf("keyword=%q line=%q", keyword, line)
	}
}

func TestLogLineLimitBoundsValue(t *testing.T) {
	if got := logLineLimit(map[string]string{discovery.LabelLogLines: "1000"}); got != 500 {
		t.Fatalf("logLineLimit = %d, want 500", got)
	}
	if got := logLineLimit(map[string]string{discovery.LabelLogLines: "bad"}); got != 100 {
		t.Fatalf("logLineLimit = %d, want 100", got)
	}
}

func TestResourceThresholdsParsePercentLabels(t *testing.T) {
	cpu, memory := resourceThresholds(map[string]string{
		discovery.LabelCPUPercent:    "85%",
		discovery.LabelMemoryPercent: "101",
	})
	if cpu != 85 {
		t.Fatalf("cpu threshold = %f, want 85", cpu)
	}
	if memory != 100 {
		t.Fatalf("memory threshold = %f, want 100", memory)
	}
}

func TestHostResourceViolations(t *testing.T) {
	violations := hostResourceViolations(hostmetrics.Snapshot{
		CPUPercent:    91,
		MemoryPercent: 40,
		DiskPercent:   95,
	}, 90, 80, 90)
	if len(violations) != 2 {
		t.Fatalf("violations = %#v", violations)
	}
}
