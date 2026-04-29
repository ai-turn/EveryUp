package models

import (
	"encoding/json"
	"time"
)

// LogLevel represents the severity level of a log entry
type LogLevel string

const (
	LogLevelError LogLevel = "error"
	LogLevelWarn  LogLevel = "warn"
	LogLevelInfo  LogLevel = "info"
	LogLevelDebug LogLevel = "debug"
	LogLevelTrace LogLevel = "trace"
)

// LogSource represents where the log originated from
const (
	LogSourceInternal = "internal"
	LogSourceExternal = "external"
	LogSourceAgent   = "agent"
)

// Log represents a log entry
type Log struct {
	ID          int64           `json:"id"`
	ServiceID   string          `json:"serviceId,omitempty"`
	Level       LogLevel        `json:"level"`
	Message     string          `json:"message"`
	Metadata    json.RawMessage `json:"metadata,omitempty"`
	Source      string          `json:"source"`
	Fingerprint string          `json:"fingerprint,omitempty"`
	CreatedAt   time.Time       `json:"createdAt"`
}

// LogCreateRequest represents a request to create a log entry
type LogCreateRequest struct {
	ServiceID string                 `json:"serviceId,omitempty"`
	Level     LogLevel               `json:"level"`
	Message   string                 `json:"message"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// LogIngestRequest represents a single-log or batch request from external services
// Single: { "level": "error", "message": "...", "metadata": {...} }
// Batch:  { "logs": [{ "level": "error", "message": "...", "metadata": {...} }, ...] }
type LogIngestRequest struct {
	// Single log fields
	Level    LogLevel               `json:"level"`
	Message  string                 `json:"message"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
	// Batch field
	Logs []LogIngestEntry `json:"logs,omitempty"`
}

// LogIngestEntry represents a single log entry within a batch request
type LogIngestEntry struct {
	Level    LogLevel               `json:"level"`
	Message  string                 `json:"message"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// LogFilter represents filter options for log queries
type LogFilter struct {
	ServiceID string    `json:"serviceId,omitempty"`
	Level     LogLevel  `json:"level,omitempty"`
	Search    string    `json:"search,omitempty"`
	From      time.Time `json:"from,omitempty"`
	To        time.Time `json:"to,omitempty"`
	Limit     int       `json:"limit,omitempty"`
	Offset    int       `json:"offset,omitempty"`
}
