package config

import (
	"testing"
	"time"
)

func TestLoadFromEnvParsesDefaults(t *testing.T) {
	t.Setenv("EVERYUP_HEALTH_URL", "http://example.com/health")
	t.Setenv("EVERYUP_CHECK_INTERVAL_SECONDS", "10")

	cfg, err := LoadFromEnv()
	if err != nil {
		t.Fatalf("LoadFromEnv returned error: %v", err)
	}

	if cfg.AgentName != defaultAgentName {
		t.Fatalf("AgentName = %q, want %q", cfg.AgentName, defaultAgentName)
	}
	if cfg.DataDir != defaultDataDir {
		t.Fatalf("DataDir = %q, want %q", cfg.DataDir, defaultDataDir)
	}
	if cfg.OTelConfigEnabled {
		t.Fatal("OTelConfigEnabled = true, want false")
	}
	if cfg.OTelConfigPath != defaultOtelConfigPath {
		t.Fatalf("OTelConfigPath = %q, want %q", cfg.OTelConfigPath, defaultOtelConfigPath)
	}
	if cfg.CheckInterval != 10*time.Second {
		t.Fatalf("CheckInterval = %s, want 10s", cfg.CheckInterval)
	}
	if !cfg.DockerDiscoveryEnabled {
		t.Fatal("DockerDiscoveryEnabled = false, want true")
	}
	if !cfg.DockerLogsEnabled {
		t.Fatal("DockerLogsEnabled = false, want true")
	}
	if cfg.DockerLogTailLines != 100 {
		t.Fatalf("DockerLogTailLines = %d, want 100", cfg.DockerLogTailLines)
	}
	if !cfg.HostMetricsEnabled {
		t.Fatal("HostMetricsEnabled = false, want true")
	}
	if cfg.HostMetricsRoot != defaultHostMetricsRoot {
		t.Fatalf("HostMetricsRoot = %q, want %q", cfg.HostMetricsRoot, defaultHostMetricsRoot)
	}
}

func TestLoadFromEnvValidatesWebSyncConfig(t *testing.T) {
	t.Setenv("EVERYUP_WEB_SYNC_ENABLED", "true")

	_, err := LoadFromEnv()
	if err == nil {
		t.Fatal("expected missing web base URL to fail")
	}

	t.Setenv("EVERYUP_WEB_BASE_URL", "https://everyup.example.com")
	_, err = LoadFromEnv()
	if err == nil {
		t.Fatal("expected missing agent API key to fail")
	}
}

func TestLoadFromEnvWebSyncAcceptsAgentAPIKey(t *testing.T) {
	t.Setenv("EVERYUP_WEB_SYNC_ENABLED", "true")
	t.Setenv("EVERYUP_WEB_BASE_URL", "https://everyup.example.com")
	t.Setenv("EVERYUP_AGENT_API_KEY", "evup_svc_abc123")

	cfg, err := LoadFromEnv()
	if err != nil {
		t.Fatalf("LoadFromEnv returned error: %v", err)
	}
	if cfg.AgentAPIKey != "evup_svc_abc123" {
		t.Fatalf("AgentAPIKey = %q, want %q", cfg.AgentAPIKey, "evup_svc_abc123")
	}
}

func TestLoadFromEnvWebSyncAcceptsDeprecatedEnrollmentToken(t *testing.T) {
	t.Setenv("EVERYUP_WEB_SYNC_ENABLED", "true")
	t.Setenv("EVERYUP_WEB_BASE_URL", "https://everyup.example.com")
	t.Setenv("EVERYUP_WEB_ENROLLMENT_TOKEN", "evup_svc_legacy")

	cfg, err := LoadFromEnv()
	if err != nil {
		t.Fatalf("LoadFromEnv returned error: %v", err)
	}
	if cfg.AgentAPIKey != "evup_svc_legacy" {
		t.Fatalf("AgentAPIKey fallback = %q, want %q", cfg.AgentAPIKey, "evup_svc_legacy")
	}
}

func TestLoadFromEnvValidatesHeartbeatConfig(t *testing.T) {
	t.Setenv("EVERYUP_HEARTBEAT_URL", "not a url")

	_, err := LoadFromEnv()
	if err == nil {
		t.Fatal("expected invalid heartbeat URL to fail")
	}
}

func TestLoadFromEnvClampsDockerLogTailLines(t *testing.T) {
	t.Setenv("EVERYUP_DOCKER_LOGS_TAIL_LINES", "5000")

	cfg, err := LoadFromEnv()
	if err != nil {
		t.Fatalf("LoadFromEnv returned error: %v", err)
	}
	if cfg.DockerLogTailLines != 1000 {
		t.Fatalf("DockerLogTailLines = %d, want 1000", cfg.DockerLogTailLines)
	}
}
