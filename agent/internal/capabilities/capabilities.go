package capabilities

import (
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

const (
	StateAvailable   = "available"
	StateDegraded    = "degraded"
	StateUnavailable = "unavailable"
)

// Status is the result of one independently usable monitoring capability.
// Reason is a stable machine-readable code; Detail is safe to show to users.
type Status struct {
	State  string `json:"state"`
	Reason string `json:"reason,omitempty"`
	Detail string `json:"detail,omitempty"`
}

type Host struct {
	OS            string `json:"os,omitempty"`
	Arch          string `json:"arch,omitempty"`
	KernelVersion string `json:"kernelVersion,omitempty"`
	BTF           bool   `json:"btf"`
	Lockdown      string `json:"lockdown,omitempty"`
}

// Report is sent with every service snapshot so Web can explain which parts
// of monitoring work on the host instead of reducing setup to pass/fail.
type Report struct {
	CheckedAt           time.Time `json:"checkedAt"`
	Host                Host      `json:"host"`
	ContainerMonitoring Status    `json:"containerMonitoring"`
	HostMetrics         Status    `json:"hostMetrics"`
	AutomaticTracing    Status    `json:"automaticTracing"`
	ContextPropagation  Status    `json:"contextPropagation"`
}

type Inputs struct {
	HostRoot                  string
	Arch                      string
	DockerEnabled             bool
	DockerReachable           bool
	HostMetricsEnabled        bool
	ObserverFound             bool
	ObserverState             string
	ContextPropagationEnabled bool
	Now                       time.Time
}

// Check evaluates host compatibility using the host filesystem already
// mounted read-only into the Agent. Docker reachability and observer state are
// supplied by the caller because they come from the Docker API.
func Check(in Inputs) Report {
	if in.Now.IsZero() {
		in.Now = time.Now().UTC()
	}
	if strings.TrimSpace(in.Arch) == "" {
		in.Arch = runtime.GOARCH
	}

	osInfo := readOSRelease(in.HostRoot)
	kernel := strings.TrimSpace(readFile(in.HostRoot, "proc/sys/kernel/osrelease"))
	lockdown := parseLockdown(readFile(in.HostRoot, "sys/kernel/security/lockdown"))
	host := Host{
		OS:            osInfo.prettyName,
		Arch:          in.Arch,
		KernelVersion: kernel,
		BTF:           readable(in.HostRoot, "sys/kernel/btf/vmlinux"),
		Lockdown:      lockdown,
	}
	if host.OS == "" {
		host.OS = osInfo.id
	}

	report := Report{CheckedAt: in.Now, Host: host}
	report.ContainerMonitoring = containerMonitoringStatus(in)
	report.HostMetrics = hostMetricsStatus(in)
	report.AutomaticTracing = automaticTracingStatus(in, host, osInfo)
	report.ContextPropagation = contextPropagationStatus(in, host, report.AutomaticTracing)
	return report
}

func containerMonitoringStatus(in Inputs) Status {
	if !in.DockerEnabled {
		return Status{State: StateUnavailable, Reason: "disabled"}
	}
	if !in.DockerReachable {
		return Status{State: StateUnavailable, Reason: "docker_unreachable"}
	}
	return Status{State: StateAvailable}
}

func hostMetricsStatus(in Inputs) Status {
	if !in.HostMetricsEnabled {
		return Status{State: StateUnavailable, Reason: "disabled"}
	}
	if !readable(in.HostRoot, "proc/stat") || !readable(in.HostRoot, "proc/meminfo") {
		return Status{State: StateUnavailable, Reason: "hostfs_unavailable"}
	}
	return Status{State: StateAvailable}
}

func automaticTracingStatus(in Inputs, host Host, osInfo osRelease) Status {
	if host.Arch != "amd64" && host.Arch != "arm64" {
		return Status{State: StateUnavailable, Reason: "unsupported_arch", Detail: host.Arch}
	}
	major, minor, ok := kernelMajorMinor(host.KernelVersion)
	if !ok {
		return Status{State: StateUnavailable, Reason: "kernel_unknown"}
	}
	rhelFamily := containsAny(strings.ToLower(osInfo.id+" "+osInfo.idLike), "rhel", "centos", "rocky", "almalinux")
	if !kernelAtLeast(major, minor, 5, 8) && !(rhelFamily && kernelAtLeast(major, minor, 4, 18)) {
		return Status{State: StateUnavailable, Reason: "unsupported_kernel", Detail: host.KernelVersion}
	}
	if !host.BTF {
		return Status{State: StateUnavailable, Reason: "btf_missing"}
	}
	if !in.DockerEnabled {
		return Status{State: StateUnavailable, Reason: "docker_required"}
	}
	if !in.DockerReachable {
		return Status{State: StateUnavailable, Reason: "docker_unreachable"}
	}
	if !in.ObserverFound || !strings.EqualFold(in.ObserverState, "running") {
		return Status{State: StateDegraded, Reason: "observer_not_running", Detail: in.ObserverState}
	}
	return Status{State: StateAvailable}
}

func contextPropagationStatus(in Inputs, host Host, tracing Status) Status {
	if tracing.State != StateAvailable {
		return Status{State: StateUnavailable, Reason: "automatic_tracing_unavailable"}
	}
	if !in.ContextPropagationEnabled {
		return Status{State: StateDegraded, Reason: "not_enabled"}
	}
	major, minor, ok := kernelMajorMinor(host.KernelVersion)
	if !ok || !kernelAtLeast(major, minor, 5, 17) {
		return Status{State: StateUnavailable, Reason: "kernel_too_old", Detail: host.KernelVersion}
	}
	switch host.Lockdown {
	case "none":
		return Status{State: StateAvailable}
	case "integrity", "confidentiality":
		return Status{State: StateUnavailable, Reason: "kernel_lockdown", Detail: host.Lockdown}
	default:
		return Status{State: StateDegraded, Reason: "lockdown_unknown"}
	}
}

type osRelease struct {
	id         string
	idLike     string
	prettyName string
}

func readOSRelease(root string) osRelease {
	data := readFile(root, "etc/os-release")
	var out osRelease
	for _, line := range strings.Split(data, "\n") {
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		value = strings.Trim(strings.TrimSpace(value), "\"'")
		switch strings.TrimSpace(key) {
		case "ID":
			out.id = value
		case "ID_LIKE":
			out.idLike = value
		case "PRETTY_NAME":
			out.prettyName = value
		}
	}
	return out
}

func parseLockdown(value string) string {
	for _, part := range strings.Fields(strings.TrimSpace(value)) {
		if strings.HasPrefix(part, "[") && strings.HasSuffix(part, "]") {
			return strings.Trim(part, "[]")
		}
	}
	return "unknown"
}

func kernelMajorMinor(value string) (int, int, bool) {
	parts := strings.SplitN(strings.TrimSpace(value), ".", 3)
	if len(parts) < 2 {
		return 0, 0, false
	}
	major, err1 := strconv.Atoi(parts[0])
	minor, err2 := strconv.Atoi(parts[1])
	return major, minor, err1 == nil && err2 == nil
}

func kernelAtLeast(major, minor, wantMajor, wantMinor int) bool {
	return major > wantMajor || (major == wantMajor && minor >= wantMinor)
}

func containsAny(value string, needles ...string) bool {
	for _, needle := range needles {
		if strings.Contains(value, needle) {
			return true
		}
	}
	return false
}

func readFile(root, relative string) string {
	data, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(relative)))
	if err != nil {
		return ""
	}
	return string(data)
}

func readable(root, relative string) bool {
	file, err := os.Open(filepath.Join(root, filepath.FromSlash(relative)))
	if err != nil {
		return false
	}
	return file.Close() == nil
}
