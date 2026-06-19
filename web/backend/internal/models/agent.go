package models

import "time"

type Agent struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Mode       string    `json:"mode"`
	Version    string    `json:"version,omitempty"`
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
