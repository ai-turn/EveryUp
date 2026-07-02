package models

import (
	"encoding/json"
	"time"
)

// OtelMetric is one OTLP metric data point flattened into a row. Gauges and
// sums carry Value; the histogram family (histogram, exponential histogram,
// summary) carries Count and Total with Value set to the average.
type OtelMetric struct {
	ID           int64           `json:"id"`
	ServiceID    string          `json:"serviceId,omitempty"`
	AgentID      string          `json:"agentId,omitempty"`
	ServiceName  string          `json:"serviceName,omitempty"`
	MetricName   string          `json:"metricName"`
	MetricType   string          `json:"metricType"`
	Unit         string          `json:"unit,omitempty"`
	Attributes   json.RawMessage `json:"attributes,omitempty"`
	Value        float64         `json:"value"`
	Count        uint64          `json:"count,omitempty"`
	Total        float64         `json:"total,omitempty"`
	TimeUnixNano uint64          `json:"timeUnixNano"`
	CreatedAt    time.Time       `json:"createdAt"`
}

// OtelMetricName describes one metric a service exports, for the picker UI.
type OtelMetricName struct {
	MetricName string    `json:"metricName"`
	MetricType string    `json:"metricType"`
	Unit       string    `json:"unit,omitempty"`
	LastAt     time.Time `json:"lastAt"`
}

// OtelMetricFilter scopes data point reads. AgentID+ServiceName is the
// connected-agent path; ServiceID the legacy log-service path.
type OtelMetricFilter struct {
	ServiceID   string
	AgentID     string
	ServiceName string
	MetricName  string
	From        time.Time
	To          time.Time
	Limit       int
}
