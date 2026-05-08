package models

import (
	"time"
)

// ApiCaptureMode controls how API requests are captured and stored.
type ApiCaptureMode string

const (
	CaptureModeDisabled   ApiCaptureMode = "disabled"
	CaptureModeErrorsOnly ApiCaptureMode = "errors_only"
	CaptureModeSampled    ApiCaptureMode = "sampled"
	CaptureModeAll        ApiCaptureMode = "all"
)

// ApiRequest represents a captured HTTP request metadata record.
type ApiRequest struct {
	ID           int64     `json:"id"`
	ServiceID    string    `json:"serviceId"`
	ServiceName  string    `json:"serviceName,omitempty"`
	RequestID    string    `json:"requestId"`
	TraceID      string    `json:"traceId,omitempty"`
	SpanID       string    `json:"spanId,omitempty"`
	Method       string    `json:"method"`
	Path         string    `json:"path"`
	PathTemplate string    `json:"pathTemplate"`
	Route        string    `json:"route,omitempty"`
	StatusCode   int       `json:"statusCode"`
	DurationMs   int       `json:"durationMs"`
	ClientIP     string    `json:"clientIp,omitempty"`
	Error        string    `json:"error,omitempty"`
	IsError      bool      `json:"isError"`
	CreatedAt    time.Time `json:"createdAt"`
}

// ApiRequestIngestEntry represents a single request entry submitted by an SDK or agent.
type ApiRequestIngestEntry struct {
	RequestID  string     `json:"requestId,omitempty"`
	Method     string     `json:"method"`
	Path       string     `json:"path"`
	StatusCode int        `json:"statusCode"`
	DurationMs int        `json:"durationMs"`
	Timestamp  *time.Time `json:"timestamp,omitempty"`
	ClientIP   string     `json:"clientIp,omitempty"`
	Error      string     `json:"error,omitempty"`
}

// ApiRequestIngestRequest is the top-level ingest payload.
// Single entry: populate ApiRequestIngestEntry fields directly.
// Batch: use Requests field.
type ApiRequestIngestRequest struct {
	ApiRequestIngestEntry
	Requests []ApiRequestIngestEntry `json:"requests,omitempty"`
}

// ApiCaptureConfig holds per-service capture settings.
type ApiCaptureConfig struct {
	Mode       ApiCaptureMode `json:"mode"`
	SampleRate int            `json:"sampleRate"`
}

func DefaultApiCaptureConfig() ApiCaptureConfig {
	return ApiCaptureConfig{
		Mode:       CaptureModeSampled,
		SampleRate: 10,
	}
}

// ApiRequestFilter holds query parameters for listing captured requests.
type ApiRequestFilter struct {
	ServiceID  string
	MinStatus  int
	MaxStatus  int
	Methods    []string
	PathPrefix string
	Search     string
	ErrorsOnly bool
	From       time.Time
	To         time.Time
	Limit      int
	Offset     int
}
