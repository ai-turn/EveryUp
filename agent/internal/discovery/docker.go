package discovery

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	ComposeProjectLabel = "com.docker.compose.project"
	ComposeServiceLabel = "com.docker.compose.service"
)

type Target struct {
	ID          string // Docker container ID; the API handle for logs/stats; changes on recreation
	Key         string // stable service identity, survives container recreation (see stableServiceKey)
	ServiceName string
	HealthType  string // "http" | "tcp" | "docker" (container-state liveness)
	HealthURL   string
	State       string // Docker container state ("running", "exited", etc.); docker liveness only
	StatusText  string // Docker status line ("Up 2 hours", "Exited (137) 2m ago")
	Labels      map[string]string
}

type ContainerStats struct {
	CPUPercent       float64
	MemoryUsageBytes uint64
	MemoryLimitBytes uint64
	MemoryPercent    float64
}

type DockerLogLine struct {
	Time    time.Time
	Message string
	Raw     string
}

func (c *DockerClient) TailLogs(ctx context.Context, containerID string, lines int) ([]string, error) {
	containerID = strings.TrimSpace(containerID)
	if containerID == "" {
		return nil, fmt.Errorf("container ID is required")
	}
	if lines <= 0 {
		lines = 50
	}
	if lines > 200 {
		lines = 200
	}

	endpoint := fmt.Sprintf("http://docker/containers/%s/logs?stdout=1&stderr=1&timestamps=1&tail=%d", url.PathEscape(containerID), lines)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("create docker logs request: %w", err)
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("query docker logs: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("docker logs returned %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("read docker logs: %w", err)
	}
	return splitDockerLogLines(data), nil
}

func (c *DockerClient) LogsSince(ctx context.Context, containerID string, since time.Time, tail int) ([]DockerLogLine, error) {
	containerID = strings.TrimSpace(containerID)
	if containerID == "" {
		return nil, fmt.Errorf("container ID is required")
	}
	if tail <= 0 {
		tail = 100
	}
	if tail > 1000 {
		tail = 1000
	}

	values := url.Values{}
	values.Set("stdout", "1")
	values.Set("stderr", "1")
	values.Set("timestamps", "1")
	values.Set("tail", strconv.Itoa(tail))
	if !since.IsZero() {
		// Docker's since filter is second-granular in common deployments. Query a
		// one-second overlap and let the caller drop records already persisted.
		values.Set("since", strconv.FormatInt(since.Add(-time.Second).Unix(), 10))
	}

	endpoint := fmt.Sprintf("http://docker/containers/%s/logs?%s", url.PathEscape(containerID), values.Encode())
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("create docker logs request: %w", err)
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("query docker logs: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("docker logs returned %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, fmt.Errorf("read docker logs: %w", err)
	}
	return parseDockerLogLines(data), nil
}
func (c *DockerClient) ContainerStats(ctx context.Context, containerID string) (ContainerStats, error) {
	containerID = strings.TrimSpace(containerID)
	if containerID == "" {
		return ContainerStats{}, fmt.Errorf("container ID is required")
	}
	endpoint := fmt.Sprintf("http://docker/containers/%s/stats?stream=false", url.PathEscape(containerID))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return ContainerStats{}, fmt.Errorf("create docker stats request: %w", err)
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return ContainerStats{}, fmt.Errorf("query docker stats: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return ContainerStats{}, fmt.Errorf("docker stats returned %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var payload dockerStatsResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return ContainerStats{}, fmt.Errorf("decode docker stats: %w", err)
	}
	return statsFromDocker(payload), nil
}

type DockerClient struct {
	socketPath string
	client     *http.Client
}

type dockerContainer struct {
	ID              string            `json:"Id"`
	Names           []string          `json:"Names"`
	Image           string            `json:"Image"`
	Labels          map[string]string `json:"Labels"`
	State           string            `json:"State"`  // "running", "exited", "dead", "created", etc.
	Status          string            `json:"Status"` // human-readable, e.g. "Up 2 hours", "Exited (0) 3 minutes ago"
	NetworkSettings struct {
		Networks map[string]struct {
			IPAddress string `json:"IPAddress"`
		} `json:"Networks"`
	} `json:"NetworkSettings"`
}

type dockerStatsResponse struct {
	CPUStats struct {
		CPUUsage struct {
			TotalUsage  uint64   `json:"total_usage"`
			PercpuUsage []uint64 `json:"percpu_usage"`
		} `json:"cpu_usage"`
		SystemCPUUsage uint64 `json:"system_cpu_usage"`
		OnlineCPUs     uint32 `json:"online_cpus"`
	} `json:"cpu_stats"`
	PreCPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemCPUUsage uint64 `json:"system_cpu_usage"`
	} `json:"precpu_stats"`
	MemoryStats struct {
		Usage uint64 `json:"usage"`
		Limit uint64 `json:"limit"`
		Stats struct {
			Cache uint64 `json:"cache"`
		} `json:"stats"`
	} `json:"memory_stats"`
}

func NewDockerClient(socketPath string, timeout time.Duration) *DockerClient {
	if socketPath == "" {
		socketPath = "/var/run/docker.sock"
	}
	if timeout <= 0 {
		timeout = 5 * time.Second
	}

	dialNetwork := "unix"
	dialAddress := socketPath
	if strings.HasPrefix(socketPath, "tcp://") {
		dialNetwork = "tcp"
		dialAddress = strings.TrimPrefix(socketPath, "tcp://")
	}

	transport := &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			var dialer net.Dialer
			return dialer.DialContext(ctx, dialNetwork, dialAddress)
		},
	}

	return &DockerClient{
		socketPath: socketPath,
		client:     &http.Client{Transport: transport, Timeout: timeout},
	}
}

func (c *DockerClient) fetchContainers(ctx context.Context) ([]dockerContainer, error) {
	// all=true so stopped/exited containers still appear; a docker-liveness
	// target needs to report "down" rather than silently vanishing.
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://docker/containers/json?all=true", nil)
	if err != nil {
		return nil, fmt.Errorf("create docker request: %w", err)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("query docker socket %s: %w", c.socketPath, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("docker api returned %d", resp.StatusCode)
	}

	var containers []dockerContainer
	if err := json.NewDecoder(resp.Body).Decode(&containers); err != nil {
		return nil, fmt.Errorf("decode docker response: %w", err)
	}
	return containers, nil
}

func (c *DockerClient) ListTargets(ctx context.Context) ([]Target, error) {
	containers, err := c.fetchContainers(ctx)
	if err != nil {
		return nil, err
	}

	targets := make([]Target, 0, len(containers))
	for _, container := range containers {
		target := TargetFromContainer(container.ID, containerName(container), container.Labels)
		target.State = container.State
		target.StatusText = container.Status
		targets = append(targets, target)
	}
	return targets, nil
}

// ServiceIPMap maps each container's network identities — bridge IP(s),
// container name, and compose service label — to its service name, so the
// telemetry gateway can attribute inbound OTLP by connection source IP and
// eBPF sidecar spans by server.address (Docker's rDNS hands the sidecar the
// compose service alias, e.g. "whoami", not an IP). Best-effort: containers on
// the host network carry no distinct identity here and are simply absent (the
// app's own service.name, if any, still wins). A name claimed by two different
// services (same compose service name in two projects) is dropped from the map
// — a missing span beats a misattributed one.
func (c *DockerClient) ServiceIPMap(ctx context.Context) (map[string]string, error) {
	containers, err := c.fetchContainers(ctx)
	if err != nil {
		return nil, err
	}

	keyToService := make(map[string]string)
	ambiguous := make(map[string]bool)
	add := func(key, service string) {
		key = strings.TrimSpace(key)
		if key == "" || ambiguous[key] {
			return
		}
		if existing, ok := keyToService[key]; ok && existing != service {
			delete(keyToService, key)
			ambiguous[key] = true
			return
		}
		keyToService[key] = service
	}

	for _, container := range containers {
		name := serviceNameFromDocker(container.ID, containerName(container), container.Labels)
		for _, network := range container.NetworkSettings.Networks {
			add(network.IPAddress, name)
		}
		add(containerName(container), name)
		add(container.Labels[ComposeServiceLabel], name)
	}
	return keyToService, nil
}

// ServiceProcessMaps walks each running container's processes (docker top) and
// returns two views the agent refreshes together each cycle:
//
//   - pidToService: host-namespace PID -> service name, so the telemetry
//     gateway can attribute eBPF sidecar spans (service.instance.id "host:pid").
//   - serviceRuntime: service name -> detected runtime ("java", "node", ...),
//     from process commands with the image name as fallback, so the UI can show
//     runtime-specific OTel setup guidance.
//
// Best-effort: a container whose top call fails is simply absent from both
// (its spans are dropped until the next refresh, its runtime stays unknown).
func (c *DockerClient) ServiceProcessMaps(ctx context.Context) (map[int]string, map[string]string, error) {
	containers, err := c.fetchContainers(ctx)
	if err != nil {
		return nil, nil, err
	}

	pidToService := make(map[int]string)
	serviceRuntime := make(map[string]string)
	for _, container := range containers {
		if container.State != "running" {
			continue
		}
		name := serviceNameFromDocker(container.ID, containerName(container), container.Labels)
		pids, cmds, err := c.containerProcesses(ctx, container.ID)
		if err != nil {
			continue
		}
		for _, pid := range pids {
			pidToService[pid] = name
		}
		if runtime := detectRuntime(container.Image, cmds); runtime != "" {
			serviceRuntime[name] = runtime
		}
	}
	return pidToService, serviceRuntime, nil
}

type dockerTopResponse struct {
	Titles    []string   `json:"Titles"`
	Processes [][]string `json:"Processes"`
}

func (c *DockerClient) containerProcesses(ctx context.Context, containerID string) ([]int, []string, error) {
	endpoint := fmt.Sprintf("http://docker/containers/%s/top", url.PathEscape(containerID))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, nil, fmt.Errorf("create docker top request: %w", err)
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, nil, fmt.Errorf("query docker top: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, nil, fmt.Errorf("docker top returned %d", resp.StatusCode)
	}
	var top dockerTopResponse
	if err := json.NewDecoder(resp.Body).Decode(&top); err != nil {
		return nil, nil, fmt.Errorf("decode docker top response: %w", err)
	}
	pids, cmds := parseTopRows(top.Titles, top.Processes)
	return pids, cmds, nil
}

// parseTopRows extracts the PID and CMD columns from a docker top response.
func parseTopRows(titles []string, processes [][]string) ([]int, []string) {
	pidCol, cmdCol := -1, -1
	for i, title := range titles {
		switch strings.ToUpper(strings.TrimSpace(title)) {
		case "PID":
			pidCol = i
		case "CMD", "COMMAND":
			cmdCol = i
		}
	}
	var pids []int
	var cmds []string
	for _, row := range processes {
		if pidCol >= 0 && pidCol < len(row) {
			if pid, err := strconv.Atoi(strings.TrimSpace(row[pidCol])); err == nil && pid > 0 {
				pids = append(pids, pid)
			}
		}
		if cmdCol >= 0 && cmdCol < len(row) {
			if cmd := strings.TrimSpace(row[cmdCol]); cmd != "" {
				cmds = append(cmds, cmd)
			}
		}
	}
	return pids, cmds
}

// runtimeCommands maps a process executable basename (version digits trimmed,
// so "python3.12" matches "python") to a runtime.
var runtimeCommands = map[string]string{
	"java":     "java",
	"node":     "node",
	"nodejs":   "node",
	"bun":      "node",
	"python":   "python",
	"gunicorn": "python",
	"uvicorn":  "python",
	"dotnet":   "dotnet",
}

// runtimeImageHints maps an image-name substring to a runtime; checked only
// when no process command matched (custom app images hide their base image, so
// commands are the stronger signal).
var runtimeImageHints = []struct{ hint, runtime string }{
	{"temurin", "java"}, {"openjdk", "java"}, {"corretto", "java"}, {"zulu", "java"},
	{"node", "node"},
	{"python", "python"}, {"pypy", "python"},
	{"golang", "go"},
	{"dotnet", "dotnet"}, {"aspnet", "dotnet"},
}

// detectRuntime classifies a container's language runtime from its process
// commands, falling back to the image name. Returns "" when unknown — Go
// binaries are usually indistinguishable here, and that is fine: eBPF tracing
// covers them without any runtime-specific setup.
func detectRuntime(image string, cmds []string) string {
	for _, cmd := range cmds {
		fields := strings.Fields(cmd)
		if len(fields) == 0 {
			continue
		}
		exe := strings.ToLower(fields[0])
		if idx := strings.LastIndexByte(exe, '/'); idx >= 0 {
			exe = exe[idx+1:]
		}
		// "python3.12" / "node20" style version suffixes.
		exe = strings.TrimRightFunc(exe, func(r rune) bool { return r == '.' || (r >= '0' && r <= '9') })
		if runtime, ok := runtimeCommands[exe]; ok {
			return runtime
		}
	}

	image = strings.ToLower(image)
	if idx := strings.IndexByte(image, ':'); idx >= 0 {
		image = image[:idx] // drop the tag; hints like "python" would match tag digits' prefix otherwise
	}
	for _, h := range runtimeImageHints {
		if strings.Contains(image, h.hint) {
			return h.runtime
		}
	}
	return ""
}

func TargetFromContainer(containerID, fallbackName string, labels map[string]string) Target {
	serviceName := serviceNameFromDocker(containerID, fallbackName, labels)
	return Target{
		ID:          containerID,
		Key:         stableServiceKey(containerID, fallbackName, labels),
		ServiceName: serviceName,
		HealthType:  "docker",
		Labels:      copyLabels(labels),
	}
}

// stableServiceKey returns a service identity that survives container
// recreation; `docker compose up` hands out a fresh container ID each time, so
// keying on the ID orphans the card and splits its history on every redeploy.
// Precedence: compose project:service, container name, then container ID.
// ':' is used as the compose separator because it is path-segment-safe; '/'
// would break the :key route param.
func stableServiceKey(containerID, fallbackName string, labels map[string]string) string {
	project := strings.TrimSpace(labels[ComposeProjectLabel])
	service := strings.TrimSpace(labels[ComposeServiceLabel])
	if project != "" && service != "" {
		return project + ":" + service
	}
	if fallbackName != "" {
		return fallbackName
	}
	return containerID
}

func serviceNameFromDocker(containerID, fallbackName string, labels map[string]string) string {
	if service := strings.TrimSpace(labels[ComposeServiceLabel]); service != "" {
		return service
	}
	if fallbackName != "" {
		return fallbackName
	}
	return shortID(containerID)
}

func containerName(container dockerContainer) string {
	if len(container.Names) == 0 {
		return shortID(container.ID)
	}
	name := strings.TrimPrefix(container.Names[0], "/")
	if name == "" {
		return shortID(container.ID)
	}
	return name
}

func shortID(id string) string {
	if len(id) <= 12 {
		return id
	}
	return id[:12]
}

func copyLabels(labels map[string]string) map[string]string {
	if len(labels) == 0 {
		return nil
	}
	copied := make(map[string]string, len(labels))
	for key, value := range labels {
		copied[key] = value
	}
	return copied
}

func splitDockerLogLines(data []byte) []string {
	data = stripDockerStreamHeaders(data)
	parts := strings.Split(strings.ReplaceAll(string(data), "\r\n", "\n"), "\n")
	lines := make([]string, 0, len(parts))
	for _, part := range parts {
		line := strings.TrimSpace(part)
		if line != "" {
			lines = append(lines, line)
		}
	}
	return lines
}

func parseDockerLogLines(data []byte) []DockerLogLine {
	lines := splitDockerLogLines(data)
	parsed := make([]DockerLogLine, 0, len(lines))
	for _, line := range lines {
		entry := DockerLogLine{Raw: line, Message: line}
		stamp, rest, ok := strings.Cut(line, " ")
		if ok {
			if ts, err := time.Parse(time.RFC3339Nano, stamp); err == nil {
				entry.Time = ts
				entry.Message = strings.TrimSpace(rest)
			}
		}
		if entry.Message == "" {
			entry.Message = entry.Raw
		}
		if entry.Message != "" {
			parsed = append(parsed, entry)
		}
	}
	return parsed
}
func stripDockerStreamHeaders(data []byte) []byte {
	var output bytes.Buffer
	for len(data) >= 8 {
		streamType := data[0]
		if streamType != 1 && streamType != 2 {
			return data
		}
		size := int(data[4])<<24 | int(data[5])<<16 | int(data[6])<<8 | int(data[7])
		if size < 0 || len(data) < 8+size {
			return data
		}
		output.Write(data[8 : 8+size])
		data = data[8+size:]
	}
	if output.Len() == 0 {
		return data
	}
	output.Write(data)
	return output.Bytes()
}

func statsFromDocker(payload dockerStatsResponse) ContainerStats {
	onlineCPUs := float64(payload.CPUStats.OnlineCPUs)
	if onlineCPUs == 0 {
		onlineCPUs = float64(len(payload.CPUStats.CPUUsage.PercpuUsage))
	}
	if onlineCPUs == 0 {
		onlineCPUs = 1
	}
	cpuDelta := float64(payload.CPUStats.CPUUsage.TotalUsage - payload.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(payload.CPUStats.SystemCPUUsage - payload.PreCPUStats.SystemCPUUsage)
	cpuPercent := 0.0
	if cpuDelta > 0 && systemDelta > 0 {
		cpuPercent = (cpuDelta / systemDelta) * onlineCPUs * 100
	}

	memoryUsage := payload.MemoryStats.Usage
	if payload.MemoryStats.Stats.Cache > 0 && payload.MemoryStats.Stats.Cache < memoryUsage {
		memoryUsage -= payload.MemoryStats.Stats.Cache
	}
	memoryPercent := 0.0
	if payload.MemoryStats.Limit > 0 {
		memoryPercent = (float64(memoryUsage) / float64(payload.MemoryStats.Limit)) * 100
	}
	return ContainerStats{
		CPUPercent:       cpuPercent,
		MemoryUsageBytes: memoryUsage,
		MemoryLimitBytes: payload.MemoryStats.Limit,
		MemoryPercent:    memoryPercent,
	}
}
