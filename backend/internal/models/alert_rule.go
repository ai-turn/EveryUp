package models

import "time"

// AlertRuleType discriminates resource vs service rules
type AlertRuleType string

const (
	AlertRuleTypeResource AlertRuleType = "resource"
	AlertRuleTypeService  AlertRuleType = "service"
	AlertRuleTypeLog      AlertRuleType = "log"
	AlertRuleTypeSystem   AlertRuleType = "system"
)

// AlertMetric is the metric being evaluated
type AlertMetric string

const (
	AlertMetricCPU          AlertMetric = "cpu"
	AlertMetricMemory       AlertMetric = "memory"
	AlertMetricDisk         AlertMetric = "disk"
	AlertMetricStatusChange AlertMetric = "status_change"
	AlertMetricHTTPStatus   AlertMetric = "http_status"   // HTTP status code comparison
	AlertMetricResponseTime AlertMetric = "response_time" // Response time in ms
	AlertMetricLogLevel     AlertMetric = "log_level"
)

// AlertOperator defines comparison operators
type AlertOperator string

const (
	AlertOperatorGT  AlertOperator = "gt"
	AlertOperatorLT  AlertOperator = "lt"
	AlertOperatorGTE AlertOperator = "gte"
	AlertOperatorLTE AlertOperator = "lte"
	AlertOperatorEQ  AlertOperator = "eq"
)

// AlertSeverity defines alert severity levels
type AlertSeverity string

const (
	AlertSeverityCritical AlertSeverity = "critical"
	AlertSeverityWarning  AlertSeverity = "warning"
	AlertSeverityInfo     AlertSeverity = "info"
)

// AlertRule represents a threshold-based alerting rule
type AlertRule struct {
	ID        string        `json:"id"`
	Name      string        `json:"name"`
	Type      AlertRuleType `json:"type"`
	HostID    *string       `json:"hostId"`
	ServiceID *string       `json:"serviceId"`
	Metric    AlertMetric   `json:"metric"`
	Operator  AlertOperator `json:"operator"`
	Threshold float64       `json:"threshold"`
	Duration  int           `json:"duration"` // minutes of consecutive breach
	Severity  AlertSeverity `json:"severity"`
	IsEnabled bool          `json:"isEnabled"`
	IsSystem  bool          `json:"isSystem"` // system rules cannot be deleted
	Cooldown  int           `json:"cooldown"` // seconds between re-alerts
	Message   string        `json:"message"`  // optional custom alert message
	CreatedAt time.Time     `json:"createdAt"`
	UpdatedAt time.Time     `json:"updatedAt"`

	// Populated by JOIN queries, not stored in alert_rules table
	ChannelIDs []string `json:"channelIds,omitempty"`
}

// AlertRuleCreateRequest is the API request to create a rule
type AlertRuleCreateRequest struct {
	Name       string        `json:"name"`
	Type       AlertRuleType `json:"type"`
	HostID     *string       `json:"hostId"`
	ServiceID  *string       `json:"serviceId"`
	Metric     AlertMetric   `json:"metric"`
	Operator   AlertOperator `json:"operator"`
	Threshold  float64       `json:"threshold"`
	Duration   int           `json:"duration"`
	Severity   AlertSeverity `json:"severity"`
	IsEnabled  *bool         `json:"isEnabled"`
	Cooldown   int           `json:"cooldown"`
	Message    string        `json:"message"`
	ChannelIDs []string      `json:"channelIds"`
}

// ToAlertRule converts request into model with defaults applied
func (r *AlertRuleCreateRequest) ToAlertRule(id string) *AlertRule {
	isEnabled := true
	if r.IsEnabled != nil {
		isEnabled = *r.IsEnabled
	}
	if r.Operator == "" {
		r.Operator = AlertOperatorGT
	}
	if r.Duration <= 0 {
		r.Duration = 1
	}
	if r.Severity == "" {
		r.Severity = AlertSeverityWarning
	}
	if r.Cooldown <= 0 {
		r.Cooldown = 300
	}
	now := time.Now()
	return &AlertRule{
		ID:         id,
		Name:       r.Name,
		Type:       r.Type,
		HostID:     r.HostID,
		ServiceID:  r.ServiceID,
		Metric:     r.Metric,
		Operator:   r.Operator,
		Threshold:  r.Threshold,
		Duration:   r.Duration,
		Severity:   r.Severity,
		IsEnabled:  isEnabled,
		Cooldown:   r.Cooldown,
		Message:    r.Message,
		ChannelIDs: r.ChannelIDs,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
}

// AlertRuleUpdateRequest is the API request to update a rule (partial)
type AlertRuleUpdateRequest struct {
	Name       *string        `json:"name"`
	HostID     *string        `json:"hostId"`
	ServiceID  *string        `json:"serviceId"`
	Metric     *AlertMetric   `json:"metric"`
	Operator   *AlertOperator `json:"operator"`
	Threshold  *float64       `json:"threshold"`
	Duration   *int           `json:"duration"`
	Severity   *AlertSeverity `json:"severity"`
	IsEnabled  *bool          `json:"isEnabled"`
	Cooldown   *int           `json:"cooldown"`
	Message    *string        `json:"message"`
	ChannelIDs *[]string      `json:"channelIds"`
}
