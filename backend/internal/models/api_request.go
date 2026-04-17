package models

import (
	"encoding/json"
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

// ApiRequest represents a captured HTTP request/response pair.
type ApiRequest struct {
	ID           int64           `json:"id"`
	ServiceID    string          `json:"serviceId"`
	RequestID    string          `json:"requestId"`
	Method       string          `json:"method"`
	Path         string          `json:"path"`
	PathTemplate string          `json:"pathTemplate"`
	StatusCode   int             `json:"statusCode"`
	DurationMs   int             `json:"durationMs"`
	ClientIP     string          `json:"clientIp,omitempty"`
	ReqHeaders   json.RawMessage `json:"reqHeaders,omitempty"`
	ReqBody      string          `json:"reqBody,omitempty"`
	ReqBodySize  int             `json:"reqBodySize"`
	ResHeaders   json.RawMessage `json:"resHeaders,omitempty"`
	ResBody      string          `json:"resBody,omitempty"`
	ResBodySize  int             `json:"resBodySize"`
	Error        string          `json:"error,omitempty"`
	IsError      bool            `json:"isError"`
	CreatedAt    time.Time       `json:"createdAt"`
}

// ApiRequestIngestEntry represents a single request entry submitted by an SDK or agent.
type ApiRequestIngestEntry struct {
	RequestID  string            `json:"requestId,omitempty"`
	Method     string            `json:"method"`
	Path       string            `json:"path"`
	StatusCode int               `json:"statusCode"`
	DurationMs int               `json:"durationMs"`
	Timestamp  *time.Time        `json:"timestamp,omitempty"`
	ClientIP   string            `json:"clientIp,omitempty"`
	ReqHeaders map[string]string `json:"reqHeaders,omitempty"`
	ReqBody    string            `json:"reqBody,omitempty"`
	ResHeaders map[string]string `json:"resHeaders,omitempty"`
	ResBody    string            `json:"resBody,omitempty"`
	Error      string            `json:"error,omitempty"`
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
	Mode             ApiCaptureMode `json:"mode"`
	SampleRate       int            `json:"sampleRate"`
	BodyMaxBytes     int            `json:"bodyMaxBytes"`
	MaskedHeaders    []string       `json:"maskedHeaders"`
	MaskedBodyFields []string       `json:"maskedBodyFields"`
}

func DefaultApiCaptureConfig() ApiCaptureConfig {
	return ApiCaptureConfig{
		Mode:         CaptureModeSampled,
		SampleRate:   10,
		BodyMaxBytes: 8192,
		MaskedHeaders: []string{
			"authorization", "cookie", "set-cookie", "x-api-key", "proxy-authorization",
		},
		MaskedBodyFields: []string{
			"password", "token", "secret", "access_token", "refresh_token", "apiKey", "api_key",
		},
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
