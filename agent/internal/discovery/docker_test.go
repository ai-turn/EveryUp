package discovery

import "testing"

func TestTargetFromLabelsUsesExplicitHealthURL(t *testing.T) {
	target, ok := TargetFromLabels("abcdef1234567890", "api", map[string]string{
		LabelEnabled:     "true",
		LabelServiceName: "public-api",
		LabelHealthType:  "http",
		LabelHealthURL:   "http://api:8080/ready",
	})
	if !ok {
		t.Fatal("expected target to be discovered")
	}
	if target.ServiceName != "public-api" {
		t.Fatalf("ServiceName = %q, want public-api", target.ServiceName)
	}
	if target.HealthURL != "http://api:8080/ready" {
		t.Fatalf("HealthURL = %q", target.HealthURL)
	}
}

func TestTargetFromLabelsBuildsHealthURLFromParts(t *testing.T) {
	target, ok := TargetFromLabels("abcdef1234567890", "api", map[string]string{
		LabelEnabled:    "1",
		LabelHealthPort: "8080",
		LabelHealthPath: "healthz",
	})
	if !ok {
		t.Fatal("expected target to be discovered")
	}
	if target.HealthURL != "http://api:8080/healthz" {
		t.Fatalf("HealthURL = %q", target.HealthURL)
	}
}

func TestTargetFromLabelsBuildsTCPAddressFromParts(t *testing.T) {
	target, ok := TargetFromLabels("abcdef1234567890", "postgres", map[string]string{
		LabelEnabled:    "true",
		LabelHealthType: "tcp",
		LabelHealthPort: "5432",
	})
	if !ok {
		t.Fatal("expected target to be discovered")
	}
	if target.HealthType != "tcp" {
		t.Fatalf("HealthType = %q, want tcp", target.HealthType)
	}
	if target.HealthURL != "postgres:5432" {
		t.Fatalf("HealthURL = %q", target.HealthURL)
	}
}

func TestTargetFromLabelsSkipsUnlessEnabled(t *testing.T) {
	tests := []struct {
		name   string
		labels map[string]string
	}{
		{name: "disabled", labels: map[string]string{LabelEnabled: "false", LabelHealthURL: "http://api:8080/health"}},
		{name: "missing-enabled", labels: map[string]string{LabelHealthURL: "http://api:8080/health"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, ok := TargetFromLabels("id", "api", tt.labels); ok {
				t.Fatal("expected target to be skipped")
			}
		})
	}
}

// Without a usable HTTP/TCP endpoint, an enabled container becomes a
// docker-liveness target instead of being skipped.
func TestTargetFromLabelsFallsBackToDockerLiveness(t *testing.T) {
	tests := []struct {
		name   string
		labels map[string]string
	}{
		{name: "enabled-only", labels: map[string]string{LabelEnabled: "true"}},
		{name: "unsupported-type", labels: map[string]string{LabelEnabled: "true", LabelHealthType: "udp"}},
		{name: "relative-url", labels: map[string]string{LabelEnabled: "true", LabelHealthURL: "/health"}},
		{name: "bad-tcp-port", labels: map[string]string{LabelEnabled: "true", LabelHealthType: "tcp", LabelHealthPort: "abc"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			target, ok := TargetFromLabels("abcdef1234567890", "api", tt.labels)
			if !ok {
				t.Fatal("expected docker-liveness target")
			}
			if target.HealthType != "docker" {
				t.Fatalf("HealthType = %q, want docker", target.HealthType)
			}
			if target.HealthURL != "" {
				t.Fatalf("HealthURL = %q, want empty for liveness", target.HealthURL)
			}
		})
	}
}

// The service key must be stable across container recreation, so it never
// falls back to the (ephemeral) container ID when a stable source exists.
func TestTargetFromLabelsUsesStableKey(t *testing.T) {
	const containerID = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
	tests := []struct {
		name    string
		labels  map[string]string
		wantKey string
	}{
		{"explicit service name", map[string]string{LabelEnabled: "true", LabelServiceName: "public-api"}, "public-api"},
		{"compose project+service", map[string]string{LabelEnabled: "true", "com.docker.compose.project": "shop", "com.docker.compose.service": "web"}, "shop:web"},
		{"container name fallback", map[string]string{LabelEnabled: "true"}, "shop-web-1"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			target, ok := TargetFromLabels(containerID, "shop-web-1", tt.labels)
			if !ok {
				t.Fatal("expected target")
			}
			if target.Key != tt.wantKey {
				t.Fatalf("Key = %q, want %q", target.Key, tt.wantKey)
			}
			if target.Key == containerID {
				t.Fatal("key fell back to the ephemeral container ID")
			}
			if target.ID != containerID {
				t.Fatalf("ID = %q, want the container ID for Docker API calls", target.ID)
			}
		})
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
		t.Fatalf("MemoryUsageBytes = %d, want 800", stats.MemoryUsageBytes)
	}
	if stats.MemoryPercent != 80 {
		t.Fatalf("MemoryPercent = %f, want 80", stats.MemoryPercent)
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
