package models

import "time"

// IncidentType represents the type of incident
type IncidentType string

const (
	IncidentTypeDown      IncidentType = "down"
	IncidentTypeDegraded  IncidentType = "degraded"
	IncidentTypeRecovered IncidentType = "recovered"
)

// Incident represents a service incident
type Incident struct {
	ID         int64        `json:"id"`
	ServiceID  string       `json:"serviceId"`
	Type       IncidentType `json:"type"`
	Message    string       `json:"message,omitempty"`
	StartedAt  time.Time    `json:"startedAt"`
	ResolvedAt *time.Time   `json:"resolvedAt,omitempty"`
}

// TimelineEvent represents an event in the incident timeline
type TimelineEvent struct {
	ID        int64     `json:"id"`
	Time      time.Time `json:"time"`
	Type      string    `json:"type"` // "error", "warning", "info", "success"
	Service   string    `json:"service"`
	Message   string    `json:"message"`
	ServiceID string    `json:"serviceId,omitempty"`
}
