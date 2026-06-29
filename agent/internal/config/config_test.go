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
	if !cfg.TelemetryGatewayEnabled {
		t.Fatal("TelemetryGatewayEnabled = false, want true")
	}
	if cfg.TelemetryGatewayListenAddr != ":4318" {
		t.Fatalf("TelemetryGatewayListenAddr = %q, want :4318", cfg.TelemetryGatewayListenAddr)
	}
	if !cfg.HostMetricsEnabled {
		t.Fatal("HostMetricsEnabled = false, want true")
	}
	if cfg.HostMetricsRoot != defaultHostMetricsRoot {
		t.Fatalf("HostMetricsRoot = %q, want %q", cfg.HostMetricsRoot, defaultHostMetricsRoot)
	}
}

func TestLoadFromEnvAgentModeDefaultsToAgent(t *testing.T) {
	cfg, err := LoadFromEnv()
	if err != nil {
		t.Fatalf("LoadFromEnv returned error: %v", err)
	}
	if cfg.Mode != "agent" {
		t.Fatalf("Mode = %q, want agent", cfg.Mode)
	}
}

func TestLoadFromEnvProxyModeRequiresUpstream(t *testing.T) {
	t.Setenv("EVERYUP_AGENT_MODE", "proxy")
	if _, err := LoadFromEnv(); err == nil {
		t.Fatal("expected proxy mode without upstream URL to fail")
	}

	t.Setenv("EVERYUP_PROXY_UPSTREAM_URL", "http://api:8080")
	cfg, err := LoadFromEnv()
	if err != nil {
		t.Fatalf("proxy mode rejected: %v", err)
	}
	if cfg.Mode != "proxy" {
		t.Fatalf("Mode = %q, want proxy", cfg.Mode)
	}
	if cfg.ProxyListenAddr != ":8080" {
		t.Fatalf("ProxyListenAddr = %q, want :8080", cfg.ProxyListenAddr)
	}
	if cfg.ProxyUpstreamURL != "http://api:8080" {
		t.Fatalf("ProxyUpstreamURL = %q", cfg.ProxyUpstreamURL)
	}
	if cfg.ProxyOTLPEndpoint != "http://everyup-agent:4318" {
		t.Fatalf("ProxyOTLPEndpoint = %q", cfg.ProxyOTLPEndpoint)
	}
	if cfg.CaptureEnabled {
		t.Fatal("CaptureEnabled = true, want default false")
	}
	if cfg.CaptureMaxBodyBytes != 8192 {
		t.Fatalf("CaptureMaxBodyBytes = %d, want 8192", cfg.CaptureMaxBodyBytes)
	}
}

func TestLoadFromEnvProxyCaptureConfig(t *testing.T) {
	t.Setenv("EVERYUP_AGENT_MODE", "proxy")
	t.Setenv("EVERYUP_PROXY_UPSTREAM_URL", "http://api:8080")
	t.Setenv("EVERYUP_PROXY_OTLP_ENDPOINT", "http://collector:4318")
	t.Setenv("EVERYUP_CAPTURE_ENABLED", "true")
	t.Setenv("EVERYUP_CAPTURE_ROUTES", "/api/...,/hooks/*")
	t.Setenv("EVERYUP_CAPTURE_EXCLUDE_ROUTES", "/auth,/upload")
	t.Setenv("EVERYUP_CAPTURE_MAX_BODY_BYTES", "4096")
	t.Setenv("EVERYUP_CAPTURE_ON_STATUS", "418,500-599")
	t.Setenv("EVERYUP_CAPTURE_ON_SLOW_MS", "1500")

	cfg, err := LoadFromEnv()
	if err != nil {
		t.Fatalf("LoadFromEnv returned error: %v", err)
	}
	if !cfg.CaptureEnabled {
		t.Fatal("CaptureEnabled = false, want true")
	}
	if len(cfg.CaptureRoutes) != 2 || cfg.CaptureRoutes[0] != "/api/..." {
		t.Fatalf("CaptureRoutes = %#v", cfg.CaptureRoutes)
	}
	if len(cfg.CaptureExcludeRoutes) != 2 || cfg.CaptureExcludeRoutes[1] != "/upload" {
		t.Fatalf("CaptureExcludeRoutes = %#v", cfg.CaptureExcludeRoutes)
	}
	if cfg.CaptureMaxBodyBytes != 4096 {
		t.Fatalf("CaptureMaxBodyBytes = %d", cfg.CaptureMaxBodyBytes)
	}
	if cfg.CaptureOnStatus != "418,500-599" {
		t.Fatalf("CaptureOnStatus = %q", cfg.CaptureOnStatus)
	}
	if cfg.CaptureOnSlow != 1500*time.Millisecond {
		t.Fatalf("CaptureOnSlow = %s", cfg.CaptureOnSlow)
	}
	if cfg.ProxyOTLPEndpoint != "http://collector:4318" {
		t.Fatalf("ProxyOTLPEndpoint = %q", cfg.ProxyOTLPEndpoint)
	}
}

func TestLoadFromEnvRejectsUnknownMode(t *testing.T) {
	t.Setenv("EVERYUP_AGENT_MODE", "bogus")
	if _, err := LoadFromEnv(); err == nil {
		t.Fatal("expected error for invalid EVERYUP_AGENT_MODE, got nil")
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
