package handlers

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestNewAgentJoinCodeShapeAndTTL(t *testing.T) {
	now := time.Date(2026, 7, 17, 0, 0, 0, 0, time.UTC)
	plain, hash, expiresAt, err := newAgentJoinCode(now)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(plain, "evup_join_") || len(plain) != len("evup_join_")+32 {
		t.Fatalf("unexpected join code shape: %q", plain)
	}
	if len(hash) != 64 || !expiresAt.Equal(now.Add(10*time.Minute)) {
		t.Fatalf("hash length=%d expiresAt=%s", len(hash), expiresAt)
	}
}

func TestBuildAgentComposePassesDockerComposeValidation(t *testing.T) {
	docker, err := exec.LookPath("docker")
	if err != nil {
		t.Skip("docker CLI is not installed")
	}
	compose := buildAgentCompose("https://everyup.example.com", "edge \"east\"", "evup_svc_test")
	path := filepath.Join(t.TempDir(), "compose.yaml")
	if err := os.WriteFile(path, []byte(compose), 0o600); err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command(docker, "compose", "-f", path, "config", "--quiet")
	cmd.Env = append(os.Environ(), "EVERYUP_DOCKER_GID=999")
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("docker compose config: %v\n%s", err, output)
	}
}

func TestAgentBundleIncludesSharedMonitoringNetwork(t *testing.T) {
	compose := buildAgentCompose("https://everyup.example.com", "edge", "evup_svc_test")
	for _, expected := range []string{
		"everyup-monitoring:",
		"name: everyup-monitoring",
		"OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: \"http://everyup-agent:4318/v1/traces\"",
	} {
		if !strings.Contains(compose, expected) {
			t.Fatalf("generated Compose is missing %q", expected)
		}
	}
	if !strings.Contains(agentInstallerScript, "/usr/local/bin/everyup-otel") {
		t.Fatal("installer does not install the OTel helper")
	}
}

func TestAgentOTelCLIScriptShapeAndSyntax(t *testing.T) {
	for _, expected := range []string{
		"everyup-otel apply",
		"verify_instrumentation",
		"rollback_internal",
		"docker-compose.everyup.yml",
		"everyup-monitoring",
	} {
		if !strings.Contains(agentOTelCLIScript, expected) {
			t.Fatalf("OTel CLI is missing %q", expected)
		}
	}
	if strings.Contains(agentOTelCLIScript, "evup_svc_") || strings.Contains(agentOTelCLIScript, "evup_join_") {
		t.Fatal("public OTel CLI must not contain an Agent credential")
	}

	if sh, err := exec.LookPath("sh"); err == nil {
		path := filepath.Join(t.TempDir(), "everyup-otel")
		if err := os.WriteFile(path, []byte(agentOTelCLIScript), 0o700); err != nil {
			t.Fatal(err)
		}
		if output, err := exec.Command(sh, "-n", path).CombinedOutput(); err != nil {
			t.Fatalf("sh -n: %v\n%s", err, output)
		}
		if output, err := exec.Command(sh, path, "--help").CombinedOutput(); err != nil {
			t.Fatalf("help command: %v\n%s", err, output)
		}
		return
	}

	// Windows development machines commonly have a POSIX shell only through
	// WSL. Feed the script over stdin so the same syntax and help checks run.
	wsl, err := exec.LookPath("wsl.exe")
	if err != nil {
		t.Skip("POSIX shell is not installed")
	}
	for _, args := range [][]string{{"sh", "-n"}, {"sh", "-s", "--", "--help"}} {
		cmd := exec.Command(wsl, args...)
		cmd.Stdin = strings.NewReader(agentOTelCLIScript)
		if output, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("wsl %s: %v\n%s", strings.Join(args, " "), err, output)
		}
	}
}

func TestNormalizeAgentBaseURL(t *testing.T) {
	if got, err := normalizeAgentBaseURL(" https://example.com/everyup/ "); err != nil || got != "https://example.com/everyup" {
		t.Fatalf("got=%q err=%v", got, err)
	}
	for _, value := range []string{"localhost:3001", "file:///tmp/x", "https://user:pass@example.com", "https://example.com?q=1"} {
		if _, err := normalizeAgentBaseURL(value); err == nil {
			t.Fatalf("normalizeAgentBaseURL(%q) should fail", value)
		}
	}
}
