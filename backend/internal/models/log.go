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
	LogSourceAgent    = "agent"
	LogSourceOTLP     = "otlp"
)

// Log represents a log entry
type Log struct {
	ID             int64           `json:"id"`
	ServiceID      string          `json:"serviceId,omitempty"`
	ServiceName    string          `json:"serviceName,omitempty"`
	Level          LogLevel        `json:"level"`
	SeverityNumber int             `json:"severityNumber,omitempty"`
	Message        string          `json:"message"`
	Metadata       json.RawMessage `json:"metadata,omitempty"`
	Resource       json.RawMessage `json:"resource,omitempty"`
	Attributes     json.RawMessage `json:"attributes,omitempty"`
	TraceID        string          `json:"traceId,omitempty"`
	SpanID         string          `json:"spanId,omitempty"`
	Source         string          `json:"source"`
	Fingerprint    string          `json:"fingerprint,omitempty"`
	ObservedAt     *time.Time      `json:"observedAt,omitempty"`
	CreatedAt      time.Time       `json:"createdAt"`
}

// LogCreateRequest represents a request to create a log entry
type LogCreateRequest struct {
	ServiceID string                 `json:"serviceId,omitempty"`
	Level     LogLevel               `json:"level"`
	Message   string                 `json:"message"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// LogIngestEntry represents a single log entry projected from OTLP.
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
