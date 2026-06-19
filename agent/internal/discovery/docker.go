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
	LabelEnabled       = "everyup.enabled"
	LabelServiceName   = "everyup.service.name"
	LabelHealthType    = "everyup.health.type"
	LabelHealthURL     = "everyup.health.url"
	LabelHealthHost    = "everyup.health.host"
	LabelHealthScheme  = "everyup.health.scheme"
	LabelHealthPort    = "everyup.health.port"
	LabelHealthPath    = "everyup.health.path"
	LabelLogKeywords   = "everyup.alert.logs.keywords"
	LabelLogLines      = "everyup.alert.logs.lines"
	LabelCPUPercent    = "everyup.alert.cpu.percent"
	LabelMemoryPercent = "everyup.alert.memory.percent"
)

type Target struct {
	ID          string
	ServiceName string
	HealthType  string
	HealthURL   string
	Labels      map[string]string
}

type ContainerStats struct {
	CPUPercent       float64
	MemoryUsageBytes uint64
	MemoryLimitBytes uint64
	MemoryPercent    float64
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

func (c *DockerClient) RestartContainer(ctx context.Context, containerID string, timeoutSeconds int) error {
	containerID = strings.TrimSpace(containerID)
	if containerID == "" {
		return fmt.Errorf("container ID is required")
	}
	if timeoutSeconds < 0 {
		timeoutSeconds = 10
	}

	endpoint := fmt.Sprintf("http://docker/containers/%s/restart?t=%d", url.PathEscape(containerID), timeoutSeconds)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, nil)
	if err != nil {
		return fmt.Errorf("create docker restart request: %w", err)
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("query docker restart: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("docker restart returned %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

type DockerClient struct {
	socketPath string
	client     *http.Client
}

type dockerContainer struct {
	ID     string            `json:"Id"`
	Names  []string          `json:"Names"`
	Labels map[string]string `json:"Labels"`
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

func (c *DockerClient) ListTargets(ctx context.Context) ([]Target, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://docker/containers/json", nil)
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

	targets := make([]Target, 0, len(containers))
	for _, container := range containers {
		target, ok := TargetFromLabels(container.ID, containerName(container), container.Labels)
		if ok {
			targets = append(targets, target)
		}
	}
	return targets, nil
}

func TargetFromLabels(containerID, fallbackName string, labels map[string]string) (Target, bool) {
	if !truthy(labels[LabelEnabled]) {
		return Target{}, false
	}

	healthType := strings.ToLower(strings.TrimSpace(labels[LabelHealthType]))
	if healthType == "" {
		healthType = "http"
	}
	if healthType != "http" && healthType != "tcp" {
		return Target{}, false
	}

	healthURL := strings.TrimSpace(labels[LabelHealthURL])
	if healthType == "http" && healthURL == "" {
		healthURL = buildHealthURL(fallbackName, labels)
	}
	if healthType == "tcp" && healthURL == "" {
		healthURL = buildTCPAddress(fallbackName, labels)
	}
	if !validHealthEndpoint(healthType, healthURL) {
		return Target{}, false
	}

	serviceName := strings.TrimSpace(labels[LabelServiceName])
	if serviceName == "" {
		serviceName = fallbackName
	}
	if serviceName == "" {
		serviceName = shortID(containerID)
	}

	return Target{
		ID:          containerID,
		ServiceName: serviceName,
		HealthType:  healthType,
		HealthURL:   healthURL,
		Labels:      copyLabels(labels),
	}, true
}

func buildTCPAddress(fallbackHost string, labels map[string]string) string {
	host := strings.TrimSpace(labels[LabelHealthHost])
	if host == "" {
		host = fallbackHost
	}
	port := strings.TrimSpace(labels[LabelHealthPort])
	if host == "" || port == "" {
		return ""
	}
	if _, err := strconv.Atoi(port); err != nil {
		return ""
	}
	return net.JoinHostPort(host, port)
}

func buildHealthURL(host string, labels map[string]string) string {
	if host == "" {
		return ""
	}
	scheme := strings.TrimSpace(labels[LabelHealthScheme])
	if scheme == "" {
		scheme = "http"
	}
	port := strings.TrimSpace(labels[LabelHealthPort])
	if port == "" {
		return ""
	}
	if _, err := strconv.Atoi(port); err != nil {
		return ""
	}
	path := strings.TrimSpace(labels[LabelHealthPath])
	if path == "" {
		path = "/health"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return fmt.Sprintf("%s://%s:%s%s", scheme, host, port, path)
}

func truthy(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func validAbsoluteURL(value string) bool {
	parsed, err := url.ParseRequestURI(value)
	return err == nil && parsed.Scheme != "" && parsed.Host != ""
}

func validHealthEndpoint(healthType, value string) bool {
	if value == "" {
		return false
	}
	if healthType == "http" {
		return validAbsoluteURL(value)
	}
	host, port, err := net.SplitHostPort(value)
	if err != nil {
		return false
	}
	return strings.TrimSpace(host) != "" && strings.TrimSpace(port) != ""
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
