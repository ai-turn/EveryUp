package config

import (
	"testing"
	"time"
)

func TestLoadFromEnvRequiresTelegramConfig(t *testing.T) {
	t.Setenv("EVERYUP_TELEGRAM_BOT_TOKEN", "")
	t.Setenv("EVERYUP_TELEGRAM_CHAT_IDS", "")

	_, err := LoadFromEnv()
	if err == nil {
		t.Fatal("expected missing Telegram config to fail")
	}
}

func TestLoadFromEnvParsesDefaultsAndChatIDs(t *testing.T) {
	t.Setenv("EVERYUP_TELEGRAM_BOT_TOKEN", "token")
	t.Setenv("EVERYUP_TELEGRAM_CHAT_IDS", "123, 456")
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
	if cfg.LLMTimeout != defaultLLMTimeout {
		t.Fatalf("LLMTimeout = %s, want %s", cfg.LLMTimeout, defaultLLMTimeout)
	}
	if cfg.LLMMaxTokens != defaultLLMMaxTokens {
		t.Fatalf("LLMMaxTokens = %d, want %d", cfg.LLMMaxTokens, defaultLLMMaxTokens)
	}
	if got, want := len(cfg.TelegramChatIDs), 2; got != want {
		t.Fatalf("len(TelegramChatIDs) = %d, want %d", got, want)
	}
	if cfg.CheckInterval != 10*time.Second {
		t.Fatalf("CheckInterval = %s, want 10s", cfg.CheckInterval)
	}
	if !cfg.DockerDiscoveryEnabled {
		t.Fatal("DockerDiscoveryEnabled = false, want true")
	}
	if !cfg.ChatOpsEnabled {
		t.Fatal("ChatOpsEnabled = false, want true")
	}
	if !cfg.RunbookEnabled {
		t.Fatal("RunbookEnabled = false, want true")
	}
	if cfg.RunbookDir != defaultRunbookDir {
		t.Fatalf("RunbookDir = %q, want %q", cfg.RunbookDir, defaultRunbookDir)
	}
	if !cfg.MemoryEnabled {
		t.Fatal("MemoryEnabled = false, want true")
	}
	if cfg.MemoryPath != defaultMemoryPath {
		t.Fatalf("MemoryPath = %q, want %q", cfg.MemoryPath, defaultMemoryPath)
	}
	if !cfg.HostMetricsEnabled {
		t.Fatal("HostMetricsEnabled = false, want true")
	}
	if cfg.HostMetricsRoot != defaultHostMetricsRoot {
		t.Fatalf("HostMetricsRoot = %q, want %q", cfg.HostMetricsRoot, defaultHostMetricsRoot)
	}
	if cfg.ActionsEnabled {
		t.Fatal("ActionsEnabled = true, want false")
	}
	if !cfg.ActionDryRun {
		t.Fatal("ActionDryRun = false, want true")
	}
}

func TestLoadFromEnvValidatesWebOTLPConfig(t *testing.T) {
	t.Setenv("EVERYUP_TELEGRAM_BOT_TOKEN", "token")
	t.Setenv("EVERYUP_TELEGRAM_CHAT_IDS", "123")
	t.Setenv("EVERYUP_WEB_API_KEY", "secret")

	_, err := LoadFromEnv()
	if err == nil {
		t.Fatal("expected missing web OTLP endpoint to fail")
	}
}

func TestLoadFromEnvValidatesWebSyncConfig(t *testing.T) {
	t.Setenv("EVERYUP_TELEGRAM_BOT_TOKEN", "token")
	t.Setenv("EVERYUP_TELEGRAM_CHAT_IDS", "123")
	t.Setenv("EVERYUP_WEB_SYNC_ENABLED", "true")

	_, err := LoadFromEnv()
	if err == nil {
		t.Fatal("expected missing web base URL to fail")
	}

	t.Setenv("EVERYUP_WEB_BASE_URL", "https://everyup.example.com")
	_, err = LoadFromEnv()
	if err == nil {
		t.Fatal("expected missing web enrollment token to fail")
	}
}

func TestLoadFromEnvValidatesLLMConfig(t *testing.T) {
	t.Setenv("EVERYUP_TELEGRAM_BOT_TOKEN", "token")
	t.Setenv("EVERYUP_TELEGRAM_CHAT_IDS", "123")
	t.Setenv("EVERYUP_LLM_BASE_URL", "http://localhost:11434/v1")

	_, err := LoadFromEnv()
	if err == nil {
		t.Fatal("expected missing LLM model to fail")
	}
}

func TestLoadFromEnvValidatesHeartbeatConfig(t *testing.T) {
	t.Setenv("EVERYUP_TELEGRAM_BOT_TOKEN", "token")
	t.Setenv("EVERYUP_TELEGRAM_CHAT_IDS", "123")
	t.Setenv("EVERYUP_HEARTBEAT_URL", "not a url")

	_, err := LoadFromEnv()
	if err == nil {
		t.Fatal("expected invalid heartbeat URL to fail")
	}
}
