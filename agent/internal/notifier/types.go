package notifier

import (
	"context"
	"time"
)

const (
	SeverityInfo     = "info"
	SeverityWarning  = "warning"
	SeverityCritical = "critical"

	AlertTypeHealthCheck = "healthcheck"
	AlertTypeSystem      = "system"
)

type Message struct {
	AlertType   string
	Severity    string
	ServiceName string
	Title       string
	Body        string
	Time        time.Time
}

type Notifier interface {
	Send(ctx context.Context, msg Message) error
}
