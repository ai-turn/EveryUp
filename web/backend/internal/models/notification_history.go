package models

import "time"

// NotificationHistory represents a record of sent notifications
type NotificationHistory struct {
	ID            int       `json:"id"`
	RuleID        *string   `json:"ruleId,omitempty"`        // null for non-rule alerts (health checks, logs)
	ChannelID     string    `json:"channelId"`
	ChannelName   string    `json:"channelName"`
	ChannelType   string    `json:"channelType"`             // "discord" | "telegram" | "slack"
	AlertType     string    `json:"alertType"`               // "resource" | "healthcheck" | "log" | "scheduled"
	Severity      string    `json:"severity,omitempty"`      // "critical" | "warning" | "info"
	HostID        *string   `json:"hostId,omitempty"`
	HostName      *string   `json:"hostName,omitempty"`
	ServiceID     *string   `json:"serviceId,omitempty"`
	ServiceName   *string   `json:"serviceName,omitempty"`
	Message       string    `json:"message"`
	Status        string    `json:"status"`                  // "sent" | "failed" | "pending"
	ErrorMessage  *string   `json:"errorMessage,omitempty"`
	RetryCount    int       `json:"retryCount"`
	CreatedAt     time.Time `json:"createdAt"`
	SentAt        *time.Time `json:"sentAt,omitempty"`
}

// NotificationHistoryFilter represents query filters
type NotificationHistoryFilter struct {
	ChannelID *string
	AlertType *string
	Status    *string
	FromDate  *time.Time
	ToDate    *time.Time
	Limit     int
	Offset    int
}
