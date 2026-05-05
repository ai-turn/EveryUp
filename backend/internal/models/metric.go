package models

import "time"

// CheckStatus represents the result of a health check
type CheckStatus string

const (
	CheckStatusSuccess CheckStatus = "success"
	CheckStatusFailure CheckStatus = "failure"
)

// Metric represents a single health check result
type Metric struct {
	ID           int64       `json:"id"`
	ServiceID    string      `json:"serviceId"`
	Status       CheckStatus `json:"status"`
	ResponseTime int         `json:"responseTime"` // milliseconds
	StatusCode   int         `json:"statusCode,omitempty"`
	ErrorMessage string      `json:"errorMessage,omitempty"`
	CheckedAt    time.Time   `json:"checkedAt"`
}

// MetricSummary represents aggregated metrics for a service
type MetricSummary struct {
	ServiceID        string  `json:"serviceId"`
	TotalChecks      int     `json:"totalChecks"`
	SuccessfulChecks int     `json:"successfulChecks"`
	FailedChecks     int     `json:"failedChecks"`
	Uptime           float64 `json:"uptime"` // percentage
	AvgResponseTime  float64 `json:"avgResponseTime"`
	MinResponseTime  int     `json:"minResponseTime"`
	MaxResponseTime  int     `json:"maxResponseTime"`
}

// UptimeData represents uptime data for calendar view
type UptimeData struct {
	Date    string  `json:"date"`    // YYYY-MM-DD
	Uptime  float64 `json:"uptime"`  // 0-100
	Checks  int     `json:"checks"`
	Success int     `json:"success"`
	Failure int     `json:"failure"`
}

// TimeSeriesPoint represents a single point in time series data
type TimeSeriesPoint struct {
	Timestamp    time.Time `json:"timestamp"`
	ResponseTime int       `json:"responseTime"`
	Status       string    `json:"status"`
}

// CheckEntry is a metric record (success or failure) enriched with service info
type CheckEntry struct {
	ID           int64       `json:"id"`
	ServiceID    string      `json:"serviceId"`
	ServiceName  string      `json:"serviceName"`
	ServiceType  string      `json:"serviceType"`
	Status       CheckStatus `json:"status"` // "success" | "failure"
	ResponseTime int         `json:"responseTime"`
	StatusCode   int         `json:"statusCode,omitempty"`
	ErrorMessage string      `json:"errorMessage,omitempty"`
	CheckedAt    time.Time   `json:"checkedAt"`
}

// FailureWithService is a failed metric enriched with the service name
type FailureWithService struct {
	ID           int64       `json:"id"`
	ServiceID    string      `json:"serviceId"`
	ServiceName  string      `json:"serviceName"`
	Status       CheckStatus `json:"status"`
	ResponseTime int         `json:"responseTime"`
	StatusCode   int         `json:"statusCode,omitempty"`
	ErrorMessage string      `json:"errorMessage,omitempty"`
	CheckedAt    time.Time   `json:"checkedAt"`
}

// HealthCheckKpiSummary aggregates overall healthcheck status for the list page KPI hero
type HealthCheckKpiSummary struct {
	Total           int       `json:"total"`
	Healthy         int       `json:"healthy"`
	Unhealthy       int       `json:"unhealthy"`
	Unknown         int       `json:"unknown"`
	AvgUptime       float64   `json:"avgUptime"`
	AvgLatency      float64   `json:"avgLatency"`
	ActiveIncidents int       `json:"activeIncidents"`
	LatencyHistory  []float64 `json:"latencyHistory"` // 24 hourly avg ms, oldest→newest
}

// ServiceUptimeSummary is the uptime percentage for a single service over N days
type ServiceUptimeSummary struct {
	ServiceID   string  `json:"serviceId"`
	ServiceName string  `json:"serviceName"`
	Uptime      float64 `json:"uptime"`   // 0–100
	TotalChecks int     `json:"totalChecks"`
	Failures    int     `json:"failures"`
}
