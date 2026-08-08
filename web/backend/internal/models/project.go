package models

import "time"

// Project is an optional logical grouping. Agent-discovered data inherits the
// Project of its Agent; independent uptime monitors are members directly.
type Project struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Description  string    `json:"description,omitempty"`
	AgentCount   int       `json:"agentCount"`
	MonitorCount int       `json:"monitorCount"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}
