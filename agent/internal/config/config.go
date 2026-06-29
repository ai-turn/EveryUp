package config

import (
	"errors"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	defaultAgentName       = "everyup-agent"
	defaultServiceName     = "local-service"
	defaultCheckInterval   = 30 * time.Second
	defaultHTTPTimeout     = 5 * time.Second
	defaultAlertCooldown   = 5 * time.Minute
	defaultDataDir         = "/data"
	defaultOtelConfigPath  = "/etc/everyup/generated/otel-config.yaml"
	defaultOtelConfDir     = "/etc/everyup/conf.d"
	defaultHostMetricsRoot = "/hostfs"
)

type Config struct {
	Mode      string
	AgentName string

	HealthURL     string
	ServiceName   string
	DataDir       string
	CheckInterval time.Duration
	HTTPTimeout   time.Duration
	AlertCooldown time.Duration

	DockerDiscoveryEnabled bool
	DockerSocketPath       string
	DockerLogsEnabled      bool
	DockerLogTailLines     int
	ExcludeNames           []string
	OTelConfigEnabled      bool
	OTelConfigPath         string
	OTelConfDir            string
	OTelFileLogPaths       []string
	WebOTLPEndpoint        string
	WebBaseURL             string
	AgentAPIKey            string
	WebAgentID             string
	WebSyncEnabled         bool
	WebSyncInterval        time.Duration

	TelemetryGatewayEnabled    bool
	TelemetryGatewayListenAddr string

	HeartbeatURL      string
	HeartbeatToken    string
	HeartbeatInterval time.Duration

	HostMetricsEnabled bool
	HostMetricsRoot    string
	HostDiskPath       string
	HostCPUPercent     float64
	HostMemoryPercent  float64
	HostDiskPercent    float64

	ProxyListenAddr      string
	ProxyUpstreamURL     string
	ProxyServiceName     string
	ProxyOTLPEndpoint    string
	CaptureEnabled       bool
	CaptureRoutes        []string
	CaptureExcludeRoutes []string
	CaptureMaxBodyBytes  int
	CaptureOnStatus      string
	CaptureOnSlow        time.Duration
	CaptureMaskKeys      []string
	CaptureRegexPresets  []string
}

func LoadFromEnv() (Config, error) {
	cfg := Config{
		Mode:          strings.ToLower(getEnv("EVERYUP_AGENT_MODE", "agent")),
		AgentName:     getEnv("EVERYUP_AGENT_NAME", defaultAgentName),
		HealthURL:     strings.TrimSpace(os.Getenv("EVERYUP_HEALTH_URL")),
		ServiceName:   getEnv("EVERYUP_SERVICE_NAME", defaultServiceName),
		DataDir:       getEnv("EVERYUP_DATA_DIR", defaultDataDir),
		CheckInterval: durationSeconds("EVERYUP_CHECK_INTERVAL_SECONDS", defaultCheckInterval),
		HTTPTimeout:   durationSeconds("EVERYUP_HTTP_TIMEOUT_SECONDS", defaultHTTPTimeout),
		AlertCooldown: durationSeconds("EVERYUP_ALERT_COOLDOWN_SECONDS", defaultAlertCooldown),

		DockerDiscoveryEnabled: boolEnv("EVERYUP_DOCKER_DISCOVERY_ENABLED", true),
		DockerSocketPath:       getEnv("EVERYUP_DOCKER_SOCKET_PATH", "/var/run/docker.sock"),
		DockerLogsEnabled:      boolEnv("EVERYUP_DOCKER_LOGS_ENABLED", true),
		DockerLogTailLines:     intEnv("EVERYUP_DOCKER_LOGS_TAIL_LINES", 100),
		ExcludeNames:           splitCSV(os.Getenv("EVERYUP_EXCLUDE")),

		OTelConfigEnabled: boolEnv("EVERYUP_OTEL_CONFIG_ENABLED", false),
		OTelConfigPath:    getEnv("EVERYUP_OTEL_CONFIG_PATH", defaultOtelConfigPath),
		OTelConfDir:       getEnv("EVERYUP_OTEL_CONF_DIR", defaultOtelConfDir),
		OTelFileLogPaths:  splitCSV(os.Getenv("EVERYUP_OTEL_FILELOG_PATHS")),
		WebOTLPEndpoint:   strings.TrimSpace(os.Getenv("EVERYUP_WEB_OTLP_ENDPOINT")),
		WebBaseURL:        strings.TrimRight(strings.TrimSpace(os.Getenv("EVERYUP_WEB_BASE_URL")), "/"),
		// EVERYUP_WEB_ENROLLMENT_TOKEN is the deprecated name for the connected-mode key.
		AgentAPIKey:     envWithFallback("EVERYUP_AGENT_API_KEY", "EVERYUP_WEB_ENROLLMENT_TOKEN"),
		WebAgentID:      strings.TrimSpace(os.Getenv("EVERYUP_WEB_AGENT_ID")),
		WebSyncEnabled:  boolEnv("EVERYUP_WEB_SYNC_ENABLED", false),
		WebSyncInterval: durationSeconds("EVERYUP_WEB_SYNC_INTERVAL_SECONDS", 30*time.Second),

		TelemetryGatewayEnabled:    boolEnv("EVERYUP_TELEMETRY_GATEWAY_ENABLED", true),
		TelemetryGatewayListenAddr: getEnv("EVERYUP_TELEMETRY_GATEWAY_LISTEN_ADDR", ":4318"),

		HeartbeatURL:      strings.TrimSpace(os.Getenv("EVERYUP_HEARTBEAT_URL")),
		HeartbeatToken:    strings.TrimSpace(os.Getenv("EVERYUP_HEARTBEAT_TOKEN")),
		HeartbeatInterval: durationSeconds("EVERYUP_HEARTBEAT_INTERVAL_SECONDS", time.Minute),

		HostMetricsEnabled: boolEnv("EVERYUP_HOST_METRICS_ENABLED", true),
		HostMetricsRoot:    getEnv("EVERYUP_HOST_METRICS_ROOT", defaultHostMetricsRoot),
		HostDiskPath:       getEnv("EVERYUP_HOST_DISK_PATH", defaultHostMetricsRoot),
		HostCPUPercent:     percentEnv("EVERYUP_HOST_CPU_PERCENT", 0),
		HostMemoryPercent:  percentEnv("EVERYUP_HOST_MEMORY_PERCENT", 0),
		HostDiskPercent:    percentEnv("EVERYUP_HOST_DISK_PERCENT", 0),

		ProxyListenAddr:      getEnv("EVERYUP_PROXY_LISTEN_ADDR", ":8080"),
		ProxyUpstreamURL:     strings.TrimRight(strings.TrimSpace(os.Getenv("EVERYUP_PROXY_UPSTREAM_URL")), "/"),
		ProxyServiceName:     getEnv("EVERYUP_PROXY_SERVICE_NAME", getEnv("EVERYUP_SERVICE_NAME", defaultServiceName)),
		ProxyOTLPEndpoint:    getEnv("EVERYUP_PROXY_OTLP_ENDPOINT", "http://everyup-agent:4318"),
		CaptureEnabled:       boolEnv("EVERYUP_CAPTURE_ENABLED", false),
		CaptureRoutes:        splitCSV(os.Getenv("EVERYUP_CAPTURE_ROUTES")),
		CaptureExcludeRoutes: splitCSV(getEnv("EVERYUP_CAPTURE_EXCLUDE_ROUTES", "/login,/auth,/payment,/upload")),
		CaptureMaxBodyBytes:  intEnv("EVERYUP_CAPTURE_MAX_BODY_BYTES", 8192),
		CaptureOnStatus:      getEnv("EVERYUP_CAPTURE_ON_STATUS", "400-599"),
		CaptureOnSlow:        durationMillis("EVERYUP_CAPTURE_ON_SLOW_MS", 3*time.Second),
		CaptureMaskKeys:      splitCSV(getEnv("EVERYUP_CAPTURE_MASK_KEYS", "password,token,secret,authorization,cookie,set-cookie")),
		CaptureRegexPresets:  splitCSV(getEnv("EVERYUP_CAPTURE_REGEX_PRESET", "rrn,phone,email,card")),
	}

	switch cfg.Mode {
	case "agent", "proxy":
	default:
		return Config{}, errors.New("EVERYUP_AGENT_MODE must be one of: agent, proxy")
	}
	if cfg.Mode == "proxy" {
		if strings.TrimSpace(cfg.ProxyListenAddr) == "" {
			return Config{}, errors.New("EVERYUP_PROXY_LISTEN_ADDR is required in proxy mode")
		}
		if cfg.ProxyUpstreamURL == "" {
			return Config{}, errors.New("EVERYUP_PROXY_UPSTREAM_URL is required in proxy mode")
		}
		parsed, err := url.ParseRequestURI(cfg.ProxyUpstreamURL)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return Config{}, errors.New("EVERYUP_PROXY_UPSTREAM_URL must be an absolute URL")
		}
		parsed, err = url.ParseRequestURI(cfg.ProxyOTLPEndpoint)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return Config{}, errors.New("EVERYUP_PROXY_OTLP_ENDPOINT must be an absolute URL")
		}
		if cfg.CaptureMaxBodyBytes <= 0 {
			return Config{}, errors.New("EVERYUP_CAPTURE_MAX_BODY_BYTES must be greater than 0")
		}
	}

	if cfg.HealthURL != "" {
		parsed, err := url.ParseRequestURI(cfg.HealthURL)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return Config{}, errors.New("EVERYUP_HEALTH_URL must be an absolute URL")
		}
	}
	if cfg.CheckInterval <= 0 {
		return Config{}, errors.New("EVERYUP_CHECK_INTERVAL_SECONDS must be greater than 0")
	}
	if cfg.HTTPTimeout <= 0 {
		return Config{}, errors.New("EVERYUP_HTTP_TIMEOUT_SECONDS must be greater than 0")
	}
	if cfg.AlertCooldown <= 0 {
		return Config{}, errors.New("EVERYUP_ALERT_COOLDOWN_SECONDS must be greater than 0")
	}
	if cfg.DockerLogTailLines <= 0 {
		return Config{}, errors.New("EVERYUP_DOCKER_LOGS_TAIL_LINES must be greater than 0")
	}
	if cfg.DockerLogTailLines > 1000 {
		cfg.DockerLogTailLines = 1000
	}
	if cfg.WebOTLPEndpoint != "" {
		parsed, err := url.ParseRequestURI(cfg.WebOTLPEndpoint)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return Config{}, errors.New("EVERYUP_WEB_OTLP_ENDPOINT must be an absolute URL")
		}
	}
	if cfg.WebBaseURL != "" {
		parsed, err := url.ParseRequestURI(cfg.WebBaseURL)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return Config{}, errors.New("EVERYUP_WEB_BASE_URL must be an absolute URL")
		}
	}
	if cfg.WebSyncEnabled {
		if cfg.WebBaseURL == "" {
			return Config{}, errors.New("EVERYUP_WEB_BASE_URL is required when web sync is enabled")
		}
		if cfg.AgentAPIKey == "" {
			return Config{}, errors.New("EVERYUP_AGENT_API_KEY is required when web sync is enabled")
		}
	}
	if cfg.WebSyncInterval <= 0 {
		return Config{}, errors.New("EVERYUP_WEB_SYNC_INTERVAL_SECONDS must be greater than 0")
	}
	if cfg.TelemetryGatewayEnabled && strings.TrimSpace(cfg.TelemetryGatewayListenAddr) == "" {
		return Config{}, errors.New("EVERYUP_TELEMETRY_GATEWAY_LISTEN_ADDR is required when telemetry gateway is enabled")
	}
	if cfg.HeartbeatURL != "" {
		parsed, err := url.ParseRequestURI(cfg.HeartbeatURL)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return Config{}, errors.New("EVERYUP_HEARTBEAT_URL must be an absolute URL")
		}
	}
	if cfg.HeartbeatInterval <= 0 {
		return Config{}, errors.New("EVERYUP_HEARTBEAT_INTERVAL_SECONDS must be greater than 0")
	}
	for key, value := range map[string]float64{
		"EVERYUP_HOST_CPU_PERCENT":    cfg.HostCPUPercent,
		"EVERYUP_HOST_MEMORY_PERCENT": cfg.HostMemoryPercent,
		"EVERYUP_HOST_DISK_PERCENT":   cfg.HostDiskPercent,
	} {
		if value < 0 || value > 100 {
			return Config{}, errors.New(key + " must be between 0 and 100")
		}
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

// envWithFallback reads primary, falling back to a deprecated env key when unset.
func envWithFallback(primary, deprecated string) string {
	if v := strings.TrimSpace(os.Getenv(primary)); v != "" {
		return v
	}
	return strings.TrimSpace(os.Getenv(deprecated))
}

func durationSeconds(key string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	seconds, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return time.Duration(seconds) * time.Second
}

func durationMillis(key string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	millis, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return time.Duration(millis) * time.Millisecond
}

func intEnv(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item != "" {
			result = append(result, item)
		}
	}
	return result
}

func boolEnv(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	switch strings.ToLower(value) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}

func percentEnv(key string, fallback float64) float64 {
	value := strings.TrimSpace(strings.TrimSuffix(os.Getenv(key), "%"))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return fallback
	}
	return parsed
}
