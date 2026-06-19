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

// GetState retrieves the state for a specific rule and host
func (r *AlertRuleStateRepository) GetState(ruleID, hostID string) (*models.AlertRuleState, error) {
	query := `
		SELECT rule_id, host_id, breach_count, last_alerted_at, is_alerting, updated_at
		FROM alert_rule_state
		WHERE rule_id = ? AND host_id = ?
	`

	var state models.AlertRuleState
	var isAlerting int
	var lastAlertedAt sql.NullTime

	err := DB.QueryRow(query, ruleID, hostID).Scan(
		&state.RuleID,
		&state.HostID,
		&state.BreachCount,
		&lastAlertedAt,
		&isAlerting,
		&state.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	state.IsAlerting = isAlerting == 1
	if lastAlertedAt.Valid {
		state.LastAlertedAt = &lastAlertedAt.Time
	}

	return &state, nil
}

// GetAllByRule retrieves all states for a specific rule (across all hosts)
func (r *AlertRuleStateRepository) GetAllByRule(ruleID string) ([]models.AlertRuleState, error) {
	query := `
		SELECT rule_id, host_id, breach_count, last_alerted_at, is_alerting, updated_at
		FROM alert_rule_state
		WHERE rule_id = ?
	`

	rows, err := DB.Query(query, ruleID)
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

// IncrementBreach increments the breach count for a rule+host
func (r *AlertRuleStateRepository) IncrementBreach(ruleID, hostID string) error {
	query := `
		INSERT INTO alert_rule_state (rule_id, host_id, breach_count, updated_at)
		VALUES (?, ?, 1, ?)
		ON CONFLICT(rule_id, host_id) DO UPDATE SET
			breach_count = breach_count + 1,
			updated_at = ?
	`
	now := time.Now()
	_, err := DB.Exec(query, ruleID, hostID, now, now)
	return err
}

// ResetBreach resets the breach count to 0
func (r *AlertRuleStateRepository) ResetBreach(ruleID, hostID string) error {
	query := `
		INSERT INTO alert_rule_state (rule_id, host_id, breach_count, is_alerting, updated_at)
		VALUES (?, ?, 0, 0, ?)
		ON CONFLICT(rule_id, host_id) DO UPDATE SET
			breach_count = 0,
			is_alerting = 0,
			updated_at = ?
	`
	now := time.Now()
	_, err := DB.Exec(query, ruleID, hostID, now, now)
	return err
}

// SetAlerting sets the alerting state and last alerted time
func (r *AlertRuleStateRepository) SetAlerting(ruleID, hostID string, isAlerting bool) error {
	var lastAlerted *time.Time
	if isAlerting {
		now := time.Now()
		lastAlerted = &now
	}

	query := `
		INSERT INTO alert_rule_state (rule_id, host_id, is_alerting, last_alerted_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(rule_id, host_id) DO UPDATE SET
			is_alerting = excluded.is_alerting,
			last_alerted_at = excluded.last_alerted_at,
			updated_at = excluded.updated_at
	`

	alertingInt := 0
	if isAlerting {
		alertingInt = 1
	}

	now := time.Now()
	_, err := DB.Exec(query, ruleID, hostID, alertingInt, lastAlerted, now)
	return err
}

// DeleteByRule deletes all states for a specific rule
func (r *AlertRuleStateRepository) DeleteByRule(ruleID string) error {
	query := `DELETE FROM alert_rule_state WHERE rule_id = ?`
	_, err := DB.Exec(query, ruleID)
	return err
}

// DeleteByHost deletes all states for a specific host
func (r *AlertRuleStateRepository) DeleteByHost(hostID string) error {
	query := `DELETE FROM alert_rule_state WHERE host_id = ?`
	_, err := DB.Exec(query, hostID)
	return err
}

// Delete deletes a specific state
func (r *AlertRuleStateRepository) Delete(ruleID, hostID string) error {
	query := `DELETE FROM alert_rule_state WHERE rule_id = ? AND host_id = ?`
	_, err := DB.Exec(query, ruleID, hostID)
	return err
}
