package models

import (
	"encoding/json"
	"time"
)

// Span stores an OpenTelemetry span as the source-of-truth trace signal.
// Derived views such as api_requests should be populated from filtered spans,
// not used as the primary span store.
type Span struct {
	ID            int64           `json:"id"`
	ServiceID     string          `json:"serviceId,omitempty"`
	ServiceName   string          `json:"serviceName,omitempty"`
	TraceID       string          `json:"traceId"`
	SpanID        string          `json:"spanId"`
	ParentSpanID  string          `json:"parentSpanId,omitempty"`
	Name          string          `json:"name"`
	Kind          string          `json:"kind"`
	StartUnixNano uint64          `json:"startUnixNano"`
	EndUnixNano   uint64          `json:"endUnixNano"`
	DurationMs    int             `json:"durationMs"`
	StatusCode    string          `json:"statusCode,omitempty"`
	StatusMessage string          `json:"statusMessage,omitempty"`
	Attributes    json.RawMessage `json:"attributes,omitempty"`
	Events        json.RawMessage `json:"events,omitempty"`
	Links         json.RawMessage `json:"links,omitempty"`
	Resource      json.RawMessage `json:"resource,omitempty"`
	CreatedAt     time.Time       `json:"createdAt"`
}
