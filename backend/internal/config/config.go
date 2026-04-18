package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/spf13/viper"
)

// Config holds all configuration for the application
type Config struct {
	Server    ServerConfig    `mapstructure:"server"`
	Database  DatabaseConfig  `mapstructure:"database"`
	Services  []ServiceConfig `mapstructure:"services"`
	System    SystemConfig    `mapstructure:"system"`
	Auth      AuthConfig      `mapstructure:"auth"`
	Alerts    AlertsConfig    `mapstructure:"alerts"`
	Retention RetentionConfig `mapstructure:"retention"`
}

// SystemConfig holds system resource monitoring configuration
type SystemConfig struct {
	Enabled         bool          `mapstructure:"enabled"`
	CollectInterval int           `mapstructure:"collectInterval"` // seconds
	StoreInterval   int           `mapstructure:"storeInterval"`   // seconds
	SSH             SSHConfig     `mapstructure:"ssh"`
	Logging         LoggingConfig `mapstructure:"logging"`
}

// LoggingConfig holds log ingestion configuration
type LoggingConfig struct {
	AllowedLevels []string `mapstructure:"allowedLevels"` // e.g. ["error", "warn"]
}

// SSHConfig holds SSH-specific configuration
type SSHConfig struct {
	ConnectionTimeout int `mapstructure:"connectionTimeout"` // seconds
	CommandTimeout    int `mapstructure:"commandTimeout"`    // seconds
	MaxReconnects     int `mapstructure:"maxReconnectAttempts"`
	KeepAliveInterval int `mapstructure:"keepAliveInterval"` // seconds
}

// AuthConfig is reserved for future authentication configuration extensions.
type AuthConfig struct{}

// ServerConfig holds server configuration
type ServerConfig struct {
	Host         string `mapstructure:"host"`
	Port         int    `mapstructure:"port"`
	Mode         string `mapstructure:"mode"`
	AllowOrigins string `mapstructure:"allowOrigins"` // env: MT_SERVER_ALLOWORIGINS
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	Type string `mapstructure:"type"`
	Path string `mapstructure:"path"`
}

// ServiceConfig holds service monitoring configuration
type ServiceConfig struct {
	ID             string            `mapstructure:"id"`
	Name           string            `mapstructure:"name"`
	Type           string            `mapstructure:"type"` // "http" or "tcp"
	URL            string            `mapstructure:"url"`
	Method         string            `mapstructure:"method"`
	Host           string            `mapstructure:"host"`
	Port           int               `mapstructure:"port"`
	Interval       int               `mapstructure:"interval"` // seconds
	Timeout        int               `mapstructure:"timeout"`  // milliseconds
	ExpectedStatus int               `mapstructure:"expectedStatus"`
	Headers        map[string]string `mapstructure:"headers"`
	Tags           []string          `mapstructure:"tags"`
}

// AlertsConfig holds alerting configuration
type AlertsConfig struct {
	Enabled             bool          `mapstructure:"enabled"`
	ConsecutiveFailures int           `mapstructure:"consecutiveFailures"`
	LogAlertCooldown    int           `mapstructure:"logAlertCooldown"` // minutes, dedup cooldown for log alerts
	Channels            AlertChannels `mapstructure:"channels"`
}

// AlertChannels holds different alert channel configurations
type AlertChannels struct {
	Slack SlackConfig `mapstructure:"slack"`
	Email EmailConfig `mapstructure:"email"`
}

// SlackConfig holds Slack configuration
type SlackConfig struct {
	Enabled    bool   `mapstructure:"enabled"`
	WebhookURL string `mapstructure:"webhookUrl"`
}

// EmailConfig holds email configuration
type EmailConfig struct {
	Enabled    bool       `mapstructure:"enabled"`
	SMTP       SMTPConfig `mapstructure:"smtp"`
	Recipients []string   `mapstructure:"recipients"`
}

// SMTPConfig holds SMTP configuration
type SMTPConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Username string `mapstructure:"username"`
	Password string `mapstructure:"password"`
}

// RetentionConfig holds data retention configuration
type RetentionConfig struct {
	Metrics         string `mapstructure:"metrics"`
	Logs            string `mapstructure:"logs"`
	SystemMetrics   string `mapstructure:"systemMetrics"`
	ApiRequestsDays int    `mapstructure:"apiRequestsDays"`
}

// Global config instance
var cfg *Config
var viperInstance *viper.Viper

// Load loads configuration from file and environment variables
func Load(configPath string) (*Config, error) {
	viperInstance = viper.New()
	v := viperInstance

	// Set defaults
	v.SetDefault("server.host", "0.0.0.0")
	v.SetDefault("server.port", 3001)
	v.SetDefault("server.mode", "production")
	v.SetDefault("database.type", "sqlite")
	v.SetDefault("database.path", "./data/monitoring.db")
	v.SetDefault("alerts.enabled", false)
	v.SetDefault("alerts.consecutiveFailures", 3)
	v.SetDefault("alerts.logAlertCooldown", 5)
	v.SetDefault("system.enabled", true)
	v.SetDefault("system.collectInterval", 5)
	v.SetDefault("system.storeInterval", 60)
	v.SetDefault("system.ssh.connectionTimeout", 10)
	v.SetDefault("system.ssh.commandTimeout", 5)
	v.SetDefault("system.ssh.maxReconnectAttempts", 10)
	v.SetDefault("system.ssh.keepAliveInterval", 30)
	v.SetDefault("system.logging.allowedLevels", []string{"error", "warn"})
	v.SetDefault("retention.metrics", "7d")
	v.SetDefault("retention.logs", "3d")
	v.SetDefault("retention.systemMetrics", "7d")
	v.SetDefault("retention.apiRequestsDays", 14)

	// Read config file
	if configPath != "" {
		v.SetConfigFile(configPath)
	} else {
		v.SetConfigName("config")
		v.SetConfigType("json")
		v.AddConfigPath(".")
		v.AddConfigPath("./config")
	}

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
		// Config file not found, use defaults
	}

	// Environment variable overrides
	v.SetEnvPrefix("MT")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	cfg = &Config{}
	if err := v.Unmarshal(cfg); err != nil {
		return nil, fmt.Errorf("error unmarshaling config: %w", err)
	}

	// Set default values for services
	for i := range cfg.Services {
		if cfg.Services[i].Method == "" {
			cfg.Services[i].Method = "GET"
		}
		if cfg.Services[i].Interval == 0 {
			cfg.Services[i].Interval = 30
		}
		if cfg.Services[i].Timeout == 0 {
			cfg.Services[i].Timeout = 5000
		}
		if cfg.Services[i].ExpectedStatus == 0 {
			cfg.Services[i].ExpectedStatus = 200
		}
	}

	return cfg, nil
}

// Get returns the global config instance
func Get() *Config {
	return cfg
}

// UpdateSettings updates mutable config fields in memory and persists to config.json
func UpdateSettings(consecutiveFailures int, metricsRetention, logsRetention string) error {
	if viperInstance == nil || cfg == nil {
		return fmt.Errorf("config not initialized")
	}
	viperInstance.Set("alerts.consecutiveFailures", consecutiveFailures)
	viperInstance.Set("retention.metrics", metricsRetention)
	viperInstance.Set("retention.logs", logsRetention)
	cfg.Alerts.ConsecutiveFailures = consecutiveFailures
	cfg.Retention.Metrics = metricsRetention
	cfg.Retention.Logs = logsRetention
	return viperInstance.WriteConfig()
}

// GetRetentionDuration parses retention string to duration
func GetRetentionDuration(retention string) time.Duration {
	retention = strings.TrimSpace(strings.ToLower(retention))

	var multiplier time.Duration
	var value int

	if strings.HasSuffix(retention, "d") {
		multiplier = 24 * time.Hour
		fmt.Sscanf(retention, "%dd", &value)
	} else if strings.HasSuffix(retention, "h") {
		multiplier = time.Hour
		fmt.Sscanf(retention, "%dh", &value)
	} else if strings.HasSuffix(retention, "m") {
		multiplier = time.Minute
		fmt.Sscanf(retention, "%dm", &value)
	} else {
		// Default to days
		fmt.Sscanf(retention, "%d", &value)
		multiplier = 24 * time.Hour
	}

	if value <= 0 {
		value = 7 // Default 7 days
	}

	return time.Duration(value) * multiplier
}
