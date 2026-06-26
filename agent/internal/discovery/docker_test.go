package discovery

import "testing"

func TestTargetFromContainerUsesComposeServiceName(t *testing.T) {
	target := TargetFromContainer("abcdef1234567890", "shop-api-1", map[string]string{
		ComposeProjectLabel: "shop",
		ComposeServiceLabel: "api",
	})
	if target.ServiceName != "api" {
		t.Fatalf("ServiceName = %q, want api", target.ServiceName)
	}
	if target.Key != "shop:api" {
		t.Fatalf("Key = %q, want shop:api", target.Key)
	}
	if target.HealthType != "docker" {
		t.Fatalf("HealthType = %q, want docker", target.HealthType)
	}
}

func TestTargetFromContainerUsesContainerNameWithoutLabels(t *testing.T) {
	target := TargetFromContainer("abcdef1234567890", "demo-prod", nil)
	if target.ServiceName != "demo-prod" {
		t.Fatalf("ServiceName = %q, want demo-prod", target.ServiceName)
	}
	if target.Key != "demo-prod" {
		t.Fatalf("Key = %q, want demo-prod", target.Key)
	}
	if target.ID != "abcdef1234567890" {
		t.Fatalf("ID = %q", target.ID)
	}
}

func TestTargetFromContainerFallsBackToShortID(t *testing.T) {
	target := TargetFromContainer("abcdef1234567890", "", nil)
	if target.ServiceName != "abcdef123456" {
		t.Fatalf("ServiceName = %q, want short ID", target.ServiceName)
	}
	if target.Key != "abcdef1234567890" {
		t.Fatalf("Key = %q, want full ID fallback", target.Key)
	}
}

func TestSplitDockerLogLinesPlainText(t *testing.T) {
	lines := splitDockerLogLines([]byte("one\n\ntwo\r\n"))
	if len(lines) != 2 || lines[0] != "one" || lines[1] != "two" {
		t.Fatalf("lines = %#v", lines)
	}
}

func TestSplitDockerLogLinesStripsMultiplexHeaders(t *testing.T) {
	payload := []byte{
		1, 0, 0, 0, 0, 0, 0, 4,
		'o', 'n', 'e', '\n',
		2, 0, 0, 0, 0, 0, 0, 4,
		't', 'w', 'o', '\n',
	}
	lines := splitDockerLogLines(payload)
	if len(lines) != 2 || lines[0] != "one" || lines[1] != "two" {
		t.Fatalf("lines = %#v", lines)
	}
}

func TestStatsFromDockerCalculatesCPUAndMemory(t *testing.T) {
	var payload dockerStatsResponse
	payload.CPUStats.CPUUsage.TotalUsage = 300
	payload.PreCPUStats.CPUUsage.TotalUsage = 100
	payload.CPUStats.SystemCPUUsage = 2000
	payload.PreCPUStats.SystemCPUUsage = 1000
	payload.CPUStats.OnlineCPUs = 2
	payload.MemoryStats.Usage = 900
	payload.MemoryStats.Stats.Cache = 100
	payload.MemoryStats.Limit = 1000

	stats := statsFromDocker(payload)
	if stats.CPUPercent != 40 {
		t.Fatalf("CPUPercent = %f, want 40", stats.CPUPercent)
	}
	if stats.MemoryUsageBytes != 800 {
		t.Fatalf("MemoryUsageBytes = %d", stats.MemoryUsageBytes)
	}
	if stats.MemoryPercent != 80 {
		t.Fatalf("MemoryPercent = %f", stats.MemoryPercent)
	}
}

func TestNewDockerClientAcceptsTCPProxyPath(t *testing.T) {
	client := NewDockerClient("tcp://docker-socket-proxy:2375", 0)
	if client.socketPath != "tcp://docker-socket-proxy:2375" {
		t.Fatalf("socketPath = %q", client.socketPath)
	}
}

func TestParseDockerLogLinesWithTimestamp(t *testing.T) {
	lines := parseDockerLogLines([]byte("2026-06-26T01:02:03.000000004Z hello world\nplain line\n"))
	if len(lines) != 2 {
		t.Fatalf("lines = %#v", lines)
	}
	if lines[0].Time.IsZero() || lines[0].Message != "hello world" {
		t.Fatalf("first line = %#v", lines[0])
	}
	if !lines[1].Time.IsZero() || lines[1].Message != "plain line" {
		t.Fatalf("second line = %#v", lines[1])
	}
}
