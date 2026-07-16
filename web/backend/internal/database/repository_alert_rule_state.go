package database

import (
	"database/sql"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// AlertRuleStateRepository handles alert rule state persistence
type AlertRuleStateRepository struct{}

// NewAlertRuleStateRepository creates a new repository
func NewAlertRuleStateRepository() *AlertRuleStateRepository {
	return &AlertRuleStateRepository{}
}

// GetAll retrieves all alert rule states
func (r *AlertRuleStateRepository) GetAll() ([]models.AlertRuleState, error) {
	query := `
		SELECT rule_id, host_id, breach_count, last_alerted_at, is_alerting, updated_at
		FROM alert_rule_state
		ORDER BY updated_at DESC
	`

	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var states []models.AlertRuleState
	for rows.Next() {
		var state models.AlertRuleState
		var isAlerting int
		var lastAlertedAt sql.NullTime

		err := rows.Scan(
			&state.RuleID,
			&state.HostID,
			&state.BreachCount,
			&lastAlertedAt,
			&isAlerting,
			&state.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		state.IsAlerting = isAlerting == 1
		if lastAlertedAt.Valid {
			state.LastAlertedAt = &lastAlertedAt.Time
		}

		states = append(states, state)
	}

	return states, nil
}

// SaveState creates or updates the state
func (r *AlertRuleStateRepository) SaveState(state *models.AlertRuleState) error {
	query := `
		INSERT INTO alert_rule_state (rule_id, host_id, breach_count, last_alerted_at, is_alerting, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(rule_id, host_id) DO UPDATE SET
			breach_count = excluded.breach_count,
			last_alerted_at = excluded.last_alerted_at,
			is_alerting = excluded.is_alerting,
			updated_at = excluded.updated_at
	`

	isAlerting := 0
	if state.IsAlerting {
		isAlerting = 1
	}

	state.UpdatedAt = time.Now()

	_, err := DB.Exec(query,
		state.RuleID,
		state.HostID,
		state.BreachCount,
		state.LastAlertedAt,
		isAlerting,
		state.UpdatedAt,
	)
	return err
}

// Rows for a deleted rule are removed by the alert_rule_state FK
// (rule_id REFERENCES alert_rules(id) ON DELETE CASCADE).
