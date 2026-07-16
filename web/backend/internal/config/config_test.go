package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// TestLoadFileAndEnvOverride verifies precedence: env > config file > defaults,
// and that UpdateSettings persists back to the loaded file.
func TestLoadFileAndEnvOverride(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.json")
	fileJSON := `{
		"server": {"host": "127.0.0.1", "port": 4000, "mode": "development"},
		"alerts": {"consecutiveFailures": 5},
		"retention": {"metrics": "14d"}
	}`
	if err := os.WriteFile(path, []byte(fileJSON), 0644); err != nil {
		t.Fatal(err)
	}

	t.Setenv("EVERYUP_SERVER_PORT", "5555")
	t.Setenv("EVERYUP_SERVER_ALLOWORIGINS", "https://example.com")

	c, err := Load(path)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	if c.Server.Port != 5555 {
		t.Errorf("env should override file: port = %d, want 5555", c.Server.Port)
	}
	if c.Server.Host != "127.0.0.1" {
		t.Errorf("file should override default: host = %q", c.Server.Host)
	}
	if c.Server.AllowOrigins != "https://example.com" {
		t.Errorf("env-only key not applied: allowOrigins = %q", c.Server.AllowOrigins)
	}
	if c.Alerts.ConsecutiveFailures != 5 {
		t.Errorf("consecutiveFailures = %d, want 5 (from file)", c.Alerts.ConsecutiveFailures)
	}
	if c.Alerts.LogAlertCooldown != 5 {
		t.Errorf("logAlertCooldown = %d, want default 5", c.Alerts.LogAlertCooldown)
	}
	if c.Retention.Metrics != "14d" || c.Retention.Logs != "3d" {
		t.Errorf("retention = %q/%q, want 14d (file) / 3d (default)", c.Retention.Metrics, c.Retention.Logs)
	}

	// UpdateSettings persists to the same file
	if err := UpdateSettings(7, "30d", "5d", 10); err != nil {
		t.Fatalf("UpdateSettings: %v", err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var saved Config
	if err := json.Unmarshal(data, &saved); err != nil {
		t.Fatalf("saved config is not valid JSON: %v", err)
	}
	if saved.Alerts.ConsecutiveFailures != 7 || saved.Retention.Metrics != "30d" ||
		saved.Retention.Logs != "5d" || saved.System.CollectInterval != 10 {
		t.Errorf("saved settings mismatch: %+v", saved)
	}

	// Saved file must round-trip through Load
	os.Unsetenv("EVERYUP_SERVER_PORT")
	os.Unsetenv("EVERYUP_SERVER_ALLOWORIGINS")
	c2, err := Load(path)
	if err != nil {
		t.Fatalf("reload: %v", err)
	}
	if c2.Alerts.ConsecutiveFailures != 7 || c2.Server.Port != 5555 {
		t.Errorf("reload mismatch: failures=%d port=%d", c2.Alerts.ConsecutiveFailures, c2.Server.Port)
	}
}
