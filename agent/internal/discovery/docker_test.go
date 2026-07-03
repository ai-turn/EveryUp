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

func TestParseTopRows(t *testing.T) {
	titles := []string{"UID", "PID", "PPID", "CMD"}
	processes := [][]string{
		{"root", "768", "740", "java -jar /app.jar"},
		{"root", "not-a-pid", "740", "zombie"},
		{"root", "801"}, // short row: PID column present, CMD missing
		{"root"},        // short row: PID column missing, skipped
	}
	pids, cmds := parseTopRows(titles, processes)
	if len(pids) != 2 || pids[0] != 768 || pids[1] != 801 {
		t.Fatalf("pids = %v, want [768 801]", pids)
	}
	if len(cmds) != 2 || cmds[0] != "java -jar /app.jar" {
		t.Fatalf("cmds = %v", cmds)
	}

	if pids, _ := parseTopRows([]string{"UID", "CMD"}, processes); pids != nil {
		t.Fatalf("no PID column should yield nil, got %v", pids)
	}
}

func TestDetectRuntime(t *testing.T) {
	cases := []struct {
		image string
		cmds  []string
		want  string
	}{
		{"mycompany/api:1.2", []string{"java -jar /app.jar"}, "java"},                    // custom image, cmd wins
		{"mycompany/web:latest", []string{"sh -c start", "/usr/bin/node server.js"}, "node"},
		{"backend:2", []string{"gunicorn app:app -w 4"}, "python"},
		{"tool:1", []string{"/usr/local/bin/python3.12 -m http.server"}, "python"},
		{"eclipse-temurin:17-jre", nil, "java"},                                          // image fallback
		{"node:20-alpine", []string{"/whoami"}, "node"},                                  // unknown cmd -> image
		{"traefik/whoami:latest", []string{"/whoami"}, ""},                               // Go binary: unknown, by design
		{"python:3.12", nil, "python"},
		{"mcr.microsoft.com/dotnet/aspnet:8.0", nil, "dotnet"},
	}
	for _, tc := range cases {
		if got := detectRuntime(tc.image, tc.cmds); got != tc.want {
			t.Fatalf("detectRuntime(%q, %v) = %q, want %q", tc.image, tc.cmds, got, tc.want)
		}
	}
}
