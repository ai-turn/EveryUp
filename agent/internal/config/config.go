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
	defaultTelegramAPIBase = "https://api.telegram.org"
	defaultDataDir         = "/data"
	defaultOtelConfigPath  = "/etc/everyup/generated/otel-config.yaml"
	defaultOtelConfDir     = "/etc/everyup/conf.d"
	defaultLLMTimeout      = 8 * time.Second
	defaultLLMMaxTokens    = 500
	defaultRunbookDir      = "/etc/everyup/runbooks"
	defaultMemoryPath      = "/data/incident-memory.db"
	defaultHostMetricsRoot = "/hostfs"
)

type Config struct {
	AgentName string

	HealthURL     string
	ServiceName   string
	DataDir       string
	CheckInterval time.Duration
	HTTPTimeout   time.Duration
	AlertCooldown time.Duration

	DockerDiscoveryEnabled bool
	DockerSocketPath       string

	OTelConfigEnabled  bool
	OTelConfigPath     string
	OTelConfDir        string
	OTelFileLogPaths   []string
	WebOTLPEndpoint    string
	WebAPIKey          string
	WebBaseURL         string
	WebEnrollmentToken string
	WebAgentID         string
	WebSyncEnabled     bool
	WebSyncInterval    time.Duration

	LLMBaseURL   string
	LLMAPIKey    string
	LLMModel     string
	LLMTimeout   time.Duration
	LLMMaxTokens int

	TelegramBotToken string
	TelegramChatIDs  []string
	TelegramAPIBase  string

	ChatOpsEnabled bool

	RunbookEnabled bool
	RunbookDir     string

	HeartbeatURL      string
	HeartbeatToken    string
	HeartbeatInterval time.Duration

	MemoryEnabled bool
	MemoryPath    string

	HostMetricsEnabled bool
	HostMetricsRoot    string
	HostDiskPath       string
	HostCPUPercent     float64
	HostMemoryPercent  float64
	HostDiskPercent    float64

	ActionsEnabled   bool
	ActionDryRun     bool
	ActionAllowlist  []string
	ActionConfirmTTL time.Duration
}

func LoadFromEnv() (Config, error) {
	cfg := Config{
		AgentName:     getEnv("EVERYUP_AGENT_NAME", defaultAgentName),
		HealthURL:     strings.TrimSpace(os.Getenv("EVERYUP_HEALTH_URL")),
		ServiceName:   getEnv("EVERYUP_SERVICE_NAME", defaultServiceName),
		DataDir:       getEnv("EVERYUP_DATA_DIR", defaultDataDir),
		CheckInterval: durationSeconds("EVERYUP_CHECK_INTERVAL_SECONDS", defaultCheckInterval),
		HTTPTimeout:   durationSeconds("EVERYUP_HTTP_TIMEOUT_SECONDS", defaultHTTPTimeout),
		AlertCooldown: durationSeconds("EVERYUP_ALERT_COOLDOWN_SECONDS", defaultAlertCooldown),

		DockerDiscoveryEnabled: boolEnv("EVERYUP_DOCKER_DISCOVERY_ENABLED", true),
		DockerSocketPath:       getEnv("EVERYUP_DOCKER_SOCKET_PATH", "/var/run/docker.sock"),

		OTelConfigEnabled:  boolEnv("EVERYUP_OTEL_CONFIG_ENABLED", false),
		OTelConfigPath:     getEnv("EVERYUP_OTEL_CONFIG_PATH", defaultOtelConfigPath),
		OTelConfDir:        getEnv("EVERYUP_OTEL_CONF_DIR", defaultOtelConfDir),
		OTelFileLogPaths:   splitCSV(os.Getenv("EVERYUP_OTEL_FILELOG_PATHS")),
		WebOTLPEndpoint:    strings.TrimSpace(os.Getenv("EVERYUP_WEB_OTLP_ENDPOINT")),
		WebAPIKey:          strings.TrimSpace(os.Getenv("EVERYUP_WEB_API_KEY")),
		WebBaseURL:         strings.TrimRight(strings.TrimSpace(os.Getenv("EVERYUP_WEB_BASE_URL")), "/"),
		WebEnrollmentToken: strings.TrimSpace(os.Getenv("EVERYUP_WEB_ENROLLMENT_TOKEN")),
		WebAgentID:         strings.TrimSpace(os.Getenv("EVERYUP_WEB_AGENT_ID")),
		WebSyncEnabled:     boolEnv("EVERYUP_WEB_SYNC_ENABLED", false),
		WebSyncInterval:    durationSeconds("EVERYUP_WEB_SYNC_INTERVAL_SECONDS", 30*time.Second),

		LLMBaseURL:   strings.TrimRight(strings.TrimSpace(os.Getenv("EVERYUP_LLM_BASE_URL")), "/"),
		LLMAPIKey:    strings.TrimSpace(os.Getenv("EVERYUP_LLM_API_KEY")),
		LLMModel:     strings.TrimSpace(os.Getenv("EVERYUP_LLM_MODEL")),
		LLMTimeout:   durationSeconds("EVERYUP_LLM_TIMEOUT_SECONDS", defaultLLMTimeout),
		LLMMaxTokens: intEnv("EVERYUP_LLM_MAX_TOKENS", defaultLLMMaxTokens),

		TelegramBotToken: strings.TrimSpace(os.Getenv("EVERYUP_TELEGRAM_BOT_TOKEN")),
		TelegramChatIDs:  splitCSV(os.Getenv("EVERYUP_TELEGRAM_CHAT_IDS")),
		TelegramAPIBase:  strings.TrimRight(getEnv("EVERYUP_TELEGRAM_API_BASE", defaultTelegramAPIBase), "/"),

		ChatOpsEnabled: boolEnv("EVERYUP_CHATOPS_ENABLED", true),

		RunbookEnabled: boolEnv("EVERYUP_RUNBOOK_ENABLED", true),
		RunbookDir:     getEnv("EVERYUP_RUNBOOK_DIR", defaultRunbookDir),

		HeartbeatURL:      strings.TrimSpace(os.Getenv("EVERYUP_HEARTBEAT_URL")),
		HeartbeatToken:    strings.TrimSpace(os.Getenv("EVERYUP_HEARTBEAT_TOKEN")),
		HeartbeatInterval: durationSeconds("EVERYUP_HEARTBEAT_INTERVAL_SECONDS", time.Minute),

		MemoryEnabled: boolEnv("EVERYUP_MEMORY_ENABLED", true),
		MemoryPath:    getEnv("EVERYUP_MEMORY_PATH", defaultMemoryPath),

		HostMetricsEnabled: boolEnv("EVERYUP_HOST_METRICS_ENABLED", true),
		HostMetricsRoot:    getEnv("EVERYUP_HOST_METRICS_ROOT", defaultHostMetricsRoot),
		HostDiskPath:       getEnv("EVERYUP_HOST_DISK_PATH", defaultHostMetricsRoot),
		HostCPUPercent:     percentEnv("EVERYUP_HOST_CPU_PERCENT", 0),
		HostMemoryPercent:  percentEnv("EVERYUP_HOST_MEMORY_PERCENT", 0),
		HostDiskPercent:    percentEnv("EVERYUP_HOST_DISK_PERCENT", 0),

		ActionsEnabled:   boolEnv("EVERYUP_ACTIONS_ENABLED", false),
		ActionDryRun:     boolEnv("EVERYUP_ACTION_DRY_RUN", true),
		ActionAllowlist:  splitCSV(os.Getenv("EVERYUP_ACTION_ALLOWLIST")),
		ActionConfirmTTL: durationSeconds("EVERYUP_ACTION_CONFIRM_TTL_SECONDS", 5*time.Minute),
	}

	if cfg.TelegramBotToken == "" {
		return Config{}, errors.New("EVERYUP_TELEGRAM_BOT_TOKEN is required")
	}
	if len(cfg.TelegramChatIDs) == 0 {
		return Config{}, errors.New("EVERYUP_TELEGRAM_CHAT_IDS is required")
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
	if cfg.WebAPIKey != "" && cfg.WebOTLPEndpoint == "" {
		return Config{}, errors.New("EVERYUP_WEB_OTLP_ENDPOINT is required when EVERYUP_WEB_API_KEY is set")
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
		if cfg.WebEnrollmentToken == "" {
			return Config{}, errors.New("EVERYUP_WEB_ENROLLMENT_TOKEN is required when web sync is enabled")
		}
	}
	if cfg.WebSyncInterval <= 0 {
		return Config{}, errors.New("EVERYUP_WEB_SYNC_INTERVAL_SECONDS must be greater than 0")
	}
	if cfg.LLMBaseURL != "" {
		parsed, err := url.ParseRequestURI(cfg.LLMBaseURL)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return Config{}, errors.New("EVERYUP_LLM_BASE_URL must be an absolute URL")
		}
		if cfg.LLMModel == "" {
			return Config{}, errors.New("EVERYUP_LLM_MODEL is required when EVERYUP_LLM_BASE_URL is set")
		}
	}
	if cfg.LLMTimeout <= 0 {
		return Config{}, errors.New("EVERYUP_LLM_TIMEOUT_SECONDS must be greater than 0")
	}
	if cfg.LLMMaxTokens <= 0 {
		return Config{}, errors.New("EVERYUP_LLM_MAX_TOKENS must be greater than 0")
	}
	if cfg.ActionConfirmTTL <= 0 {
		return Config{}, errors.New("EVERYUP_ACTION_CONFIRM_TTL_SECONDS must be greater than 0")
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
	if cfg.MemoryEnabled && cfg.MemoryPath == "" {
		return Config{}, errors.New("EVERYUP_MEMORY_PATH is required when memory is enabled")
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
