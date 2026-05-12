package models

import (
	"time"
)

// ApiRequest represents an HTTP request projected from an OTel SERVER span.
// Direct ingest paths were removed; do not write to this table outside the
// OTLP traces handler.
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

// ApiRequestFilter holds query parameters for listing captured requests.
type ApiRequestFilter struct {
	ServiceID  string
	TraceID    string
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
