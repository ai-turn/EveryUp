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
	AgentID      string    `json:"agentId,omitempty"`
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

// ApiRequestStatBucket is one time bucket of request aggregates for the trends
// chart. Percentiles are computed only over requests with a known duration
// (durationMs > 0); access-log synthetic rows have no duration and are counted
// for volume/errors but excluded from latency.
type ApiRequestStatBucket struct {
	Time       time.Time `json:"time"`
	Count      int       `json:"count"`
	ErrorCount int       `json:"errorCount"`
	P50        int       `json:"p50"`
	P95        int       `json:"p95"`
	Timed      int       `json:"timed"` // requests contributing to percentiles
}

// ApiRequestFilter holds query parameters for listing captured requests.
type ApiRequestFilter struct {
	ServiceID   string
	AgentID     string
	ServiceName string
	TraceID     string
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
