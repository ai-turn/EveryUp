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

// AgentIncident is one unhealthy episode of an agent service, derived from
// consecutive healthy=0 runs in agent_service_history.
type AgentIncident struct {
	Key         string     `json:"key"`
	ServiceName string     `json:"serviceName"`
	StartedAt   time.Time  `json:"startedAt"`
	EndedAt     *time.Time `json:"endedAt,omitempty"` // nil while still unhealthy
	DurationSec int64      `json:"durationSec"`
	Active      bool       `json:"active"`
}

// AgentOverview is the per-project KPI rollup for the home project cards —
// one row per agent so the list renders without N+1 fetches.
type AgentOverview struct {
	AgentID         string   `json:"agentId"`
	UptimePct       *float64 `json:"uptimePct"` // 30d weighted, nil when no checks yet
	ActiveIncidents int      `json:"activeIncidents"`
	Requests24h     int      `json:"requests24h"`
	P95Ms           *int     `json:"p95Ms"` // latest timed bucket, nil when no latency data
}

type Agent struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Version    string    `json:"version,omitempty"`
	Status     string    `json:"status"`
	LastSeenAt time.Time `json:"lastSeenAt"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type AgentService struct {
	AgentID      string    `json:"agentId"`
	Key          string    `json:"key"`
	Name         string    `json:"name"`
	CheckType    string    `json:"checkType"`
	Endpoint     string    `json:"endpoint"`
	Runtime      string    `json:"runtime,omitempty"`      // agent-detected language runtime ("java", "node", ...)
	Image        string    `json:"image,omitempty"`        // container image ref incl tag
	RestartCount int       `json:"restartCount,omitempty"` // docker container restart count
	StartedAt    time.Time `json:"startedAt,omitempty"`    // container start time; UI derives uptime
	Healthy      bool      `json:"healthy"`
	Seen         bool      `json:"seen"`
	Silenced     bool      `json:"silenced"`
	LastError    string    `json:"lastError,omitempty"`
	LastStatus   int       `json:"lastStatus,omitempty"`
	LastLatency  string    `json:"lastLatency,omitempty"`
	UpdatedAt    time.Time `json:"updatedAt,omitempty"`
	ObservedAt   time.Time `json:"observedAt"`
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
