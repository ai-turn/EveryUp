package models

import "time"

// AgentServiceFlat joins AgentService with the parent Agent name for list views.
type AgentServiceFlat struct {
	AgentService
	AgentName string `json:"agentName"`
}

// ServiceHistoryPoint is one time-bucketed data point for response-time charts.
type ServiceHistoryPoint struct {
	Time      string  `json:"time"`
	LatencyMs float64 `json:"latencyMs"`
	UptimePct float64 `json:"uptimePct"`
	Total     int     `json:"total"`
}

// ServiceUptimeDay holds daily uptime stats for the 90-day calendar view.
type ServiceUptimeDay struct {
	Date          string  `json:"date"`
	UptimePct     float64 `json:"uptimePct"`
	HealthyChecks int     `json:"healthyChecks"`
	TotalChecks   int     `json:"totalChecks"`
}

type Agent struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Mode       string    `json:"mode"`
	Version    string    `json:"version,omitempty"`
	Status     string    `json:"status"`
	LastSeenAt time.Time `json:"lastSeenAt"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type AgentService struct {
	AgentID     string    `json:"agentId"`
	Key         string    `json:"key"`
	Name        string    `json:"name"`
	CheckType   string    `json:"checkType"`
	Endpoint    string    `json:"endpoint"`
	Healthy     bool      `json:"healthy"`
	Seen        bool      `json:"seen"`
	Silenced    bool      `json:"silenced"`
	LastError   string    `json:"lastError,omitempty"`
	LastStatus  int       `json:"lastStatus,omitempty"`
	LastLatency string    `json:"lastLatency,omitempty"`
	UpdatedAt   time.Time `json:"updatedAt,omitempty"`
	ObservedAt  time.Time `json:"observedAt"`
}

type AgentEvent struct {
	ID          int64                  `json:"id"`
	AgentID     string                 `json:"agentId"`
	Time        time.Time              `json:"time"`
	Type        string                 `json:"type"`
	ServiceName string                 `json:"serviceName,omitempty"`
	TargetKey   string                 `json:"targetKey,omitempty"`
	Message     string                 `json:"message,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt   time.Time              `json:"createdAt"`
}
