package capabilities

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCheckSupportedHost(t *testing.T) {
	root := supportedHost(t, "6.8.0-55-generic", "[none] integrity confidentiality")
	report := Check(Inputs{
		HostRoot:           root,
		Arch:               "amd64",
		DockerEnabled:      true,
		DockerReachable:    true,
		HostMetricsEnabled: true,
		ObserverFound:      true,
		ObserverState:      "running",
		Now:                time.Unix(100, 0).UTC(),
	})

	if report.ContainerMonitoring.State != StateAvailable || report.HostMetrics.State != StateAvailable {
		t.Fatalf("base capabilities = %+v", report)
	}
	if report.AutomaticTracing.State != StateAvailable {
		t.Fatalf("AutomaticTracing = %+v", report.AutomaticTracing)
	}
	if report.ContextPropagation.State != StateDegraded || report.ContextPropagation.Reason != "not_enabled" {
		t.Fatalf("ContextPropagation = %+v", report.ContextPropagation)
	}
	if !report.Host.BTF || report.Host.Lockdown != "none" {
		t.Fatalf("Host = %+v", report.Host)
	}
}

func TestCheckReportsMissingBTFWithoutDisablingBaseMonitoring(t *testing.T) {
	root := supportedHost(t, "5.15.0", "none [integrity] confidentiality")
	if err := os.Remove(filepath.Join(root, "sys", "kernel", "btf", "vmlinux")); err != nil {
		t.Fatal(err)
	}
	report := Check(Inputs{
		HostRoot:           root,
		Arch:               "arm64",
		DockerEnabled:      true,
		DockerReachable:    true,
		HostMetricsEnabled: true,
		ObserverFound:      true,
		ObserverState:      "running",
	})

	if report.AutomaticTracing.State != StateUnavailable || report.AutomaticTracing.Reason != "btf_missing" {
		t.Fatalf("AutomaticTracing = %+v", report.AutomaticTracing)
	}
	if report.ContainerMonitoring.State != StateAvailable || report.HostMetrics.State != StateAvailable {
		t.Fatalf("base capabilities should remain available: %+v", report)
	}
}

func TestCheckRHEL418BackportAndLockdown(t *testing.T) {
	root := supportedHost(t, "4.18.0-553.el8", "none [confidentiality]")
	writeHostFile(t, root, "etc/os-release", "ID=rocky\nID_LIKE=\"rhel centos fedora\"\nPRETTY_NAME=\"Rocky Linux 8\"\n")
	report := Check(Inputs{
		HostRoot:                  root,
		Arch:                      "amd64",
		DockerEnabled:             true,
		DockerReachable:           true,
		HostMetricsEnabled:        true,
		ObserverFound:             true,
		ObserverState:             "running",
		ContextPropagationEnabled: true,
	})

	if report.AutomaticTracing.State != StateAvailable {
		t.Fatalf("AutomaticTracing = %+v", report.AutomaticTracing)
	}
	if report.ContextPropagation.Reason != "kernel_too_old" {
		t.Fatalf("ContextPropagation = %+v", report.ContextPropagation)
	}
}

func supportedHost(t *testing.T, kernel, lockdown string) string {
	t.Helper()
	root := t.TempDir()
	writeHostFile(t, root, "etc/os-release", "ID=ubuntu\nPRETTY_NAME=\"Ubuntu 24.04 LTS\"\n")
	writeHostFile(t, root, "proc/sys/kernel/osrelease", kernel)
	writeHostFile(t, root, "proc/stat", "cpu 1 2 3 4\n")
	writeHostFile(t, root, "proc/meminfo", "MemTotal: 1 kB\n")
	writeHostFile(t, root, "sys/kernel/btf/vmlinux", "btf")
	writeHostFile(t, root, "sys/kernel/security/lockdown", lockdown)
	return root
}

func writeHostFile(t *testing.T, root, relative, content string) {
	t.Helper()
	path := filepath.Join(root, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}
