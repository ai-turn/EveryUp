package models

import "time"

// AlertRuleState represents the persistent state of an alert rule evaluation
type AlertRuleState struct {
	RuleID        string     `json:"ruleId"`
	HostID        string     `json:"hostId"`
	BreachCount   int        `json:"breachCount"`
	LastAlertedAt *time.Time `json:"lastAlertedAt,omitempty"`
	IsAlerting    bool       `json:"isAlerting"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}
