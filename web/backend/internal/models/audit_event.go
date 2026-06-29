package models

import "time"

// AuditEvent records sensitive user actions for later review.
type AuditEvent struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"userId"`
	Username  string    `json:"username"`
	Action    string    `json:"action"`
	TraceID   string    `json:"traceId,omitempty"`
	Metadata  string    `json:"metadata,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}
