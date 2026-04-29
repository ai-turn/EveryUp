package database

import (
	"database/sql"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// AlertRuleRepository handles alert rule data operations
type AlertRuleRepository struct{}

// NewAlertRuleRepository creates a new alert rule repository
func NewAlertRuleRepository() *AlertRuleRepository {
	return &AlertRuleRepository{}
}

// alertRuleSelectColumns is the column list for alert rule queries.
const alertRuleSelectColumns = `id, name, type, host_id, service_id, metric, operator,
	threshold, duration, severity, is_enabled, cooldown, COALESCE(message, '') as message,
	COALESCE(is_system, 0) as is_system, created_at, updated_at`

// scanAlertRuleFields scans alert rule columns into an AlertRule struct from a generic scanner.
func scanAlertRuleFields(scan func(dest ...interface{}) error) (models.AlertRule, error) {
	var r models.AlertRule
	var isEnabled, isSystem int
	var hostID, serviceID sql.NullString

	err := scan(
		&r.ID, &r.Name, &r.Type, &hostID, &serviceID, &r.Metric, &r.Operator,
		&r.Threshold, &r.Duration, &r.Severity, &isEnabled, &r.Cooldown, &r.Message,
		&isSystem, &r.CreatedAt, &r.UpdatedAt,
	)
	if err != nil {
		return r, err
	}

	r.IsEnabled = isEnabled == 1
	r.IsSystem = isSystem == 1
	if hostID.Valid && hostID.String != "" {
		s := hostID.String
		r.HostID = &s
	}
	if serviceID.Valid && serviceID.String != "" {
		s := serviceID.String
		r.ServiceID = &s
	}
	return r, nil
}

// loadChannelIDs loads channel IDs for a given rule.
func loadChannelIDs(ruleID string) ([]string, error) {
	rows, err := DB.Query(`SELECT channel_id FROM alert_rule_channels WHERE rule_id = ?`, ruleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// GetAll returns all alert rules with their channel IDs
func (r *AlertRuleRepository) GetAll() ([]models.AlertRule, error) {
	rows, err := DB.Query(`
		SELECT ` + alertRuleSelectColumns + `
		FROM alert_rules
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []models.AlertRule
	for rows.Next() {
		rule, err := scanAlertRuleFields(rows.Scan)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	// Load channel IDs after closing the rows iterator to avoid SQLite deadlock
	for i := range rules {
		chIDs, _ := loadChannelIDs(rules[i].ID)
		rules[i].ChannelIDs = chIDs
	}
	return rules, nil
}

// GetByID returns an alert rule by ID with channel IDs
func (r *AlertRuleRepository) GetByID(id string) (*models.AlertRule, error) {
	row := DB.QueryRow(`
		SELECT `+alertRuleSelectColumns+`
		FROM alert_rules WHERE id = ?
	`, id)

	rule, err := scanAlertRuleFields(row.Scan)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	chIDs, _ := loadChannelIDs(rule.ID)
	rule.ChannelIDs = chIDs
	return &rule, nil
}

// GetEnabledByHostID returns enabled resource rules for a given host (or global rules).
// This is the hot path used by the RuleEvaluator on every metric collection.
func (r *AlertRuleRepository) GetEnabledByHostID(hostID string) ([]models.AlertRule, error) {
	rows, err := DB.Query(`
		SELECT `+alertRuleSelectColumns+`
		FROM alert_rules
		WHERE is_enabled = 1 AND type = 'resource'
		  AND (host_id = ? OR host_id IS NULL OR host_id = '')
		ORDER BY severity DESC
	`, hostID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []models.AlertRule
	for rows.Next() {
		rule, err := scanAlertRuleFields(rows.Scan)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	// Load channel IDs after closing the rows iterator to avoid SQLite deadlock
	for i := range rules {
		chIDs, _ := loadChannelIDs(rules[i].ID)
		rules[i].ChannelIDs = chIDs
	}
	return rules, nil
}

// GetEnabledByServiceID returns enabled service rules for a given service (or global rules).
// This is the hot path used by the ServiceRuleEvaluator on every service check.
func (r *AlertRuleRepository) GetEnabledByServiceID(serviceID string) ([]models.AlertRule, error) {
	rows, err := DB.Query(`
		SELECT `+alertRuleSelectColumns+`
		FROM alert_rules
		WHERE is_enabled = 1 AND type = 'service'
		  AND (service_id = ? OR service_id IS NULL OR service_id = '')
		ORDER BY severity DESC
	`, serviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []models.AlertRule
	for rows.Next() {
		rule, err := scanAlertRuleFields(rows.Scan)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	// Load channel IDs after closing the rows iterator to avoid SQLite deadlock
	for i := range rules {
		chIDs, _ := loadChannelIDs(rules[i].ID)
		rules[i].ChannelIDs = chIDs
	}
	return rules, nil
}

// GetEnabledLogRulesByServiceID returns enabled log rules for a log service (or global log rules).
func (r *AlertRuleRepository) GetEnabledLogRulesByServiceID(serviceID string) ([]models.AlertRule, error) {
	rows, err := DB.Query(`
		SELECT `+alertRuleSelectColumns+`
		FROM alert_rules
		WHERE is_enabled = 1 AND type = 'log'
		  AND (service_id = ? OR service_id IS NULL OR service_id = '')
		ORDER BY severity DESC
	`, serviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []models.AlertRule
	for rows.Next() {
		rule, err := scanAlertRuleFields(rows.Scan)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	for i := range rules {
		chIDs, _ := loadChannelIDs(rules[i].ID)
		rules[i].ChannelIDs = chIDs
	}
	return rules, nil
}

// Create creates a new alert rule with channel mappings in a transaction.
func (r *AlertRuleRepository) Create(rule *models.AlertRule) error {
	return Transaction(func(tx *sql.Tx) error {
		isEnabled := 0
		if rule.IsEnabled {
			isEnabled = 1
		}
		isSystem := 0
		if rule.IsSystem {
			isSystem = 1
		}

		_, err := tx.Exec(`
			INSERT INTO alert_rules (id, name, type, host_id, service_id, metric, operator,
			                         threshold, duration, severity, is_enabled, cooldown,
			                         message, is_system, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, rule.ID, rule.Name, rule.Type, rule.HostID, rule.ServiceID,
			rule.Metric, rule.Operator, rule.Threshold, rule.Duration,
			rule.Severity, isEnabled, rule.Cooldown, rule.Message, isSystem, rule.CreatedAt, rule.UpdatedAt)
		if err != nil {
			return err
		}

		for _, chID := range rule.ChannelIDs {
			if _, err := tx.Exec(`INSERT INTO alert_rule_channels (rule_id, channel_id) VALUES (?, ?)`,
				rule.ID, chID); err != nil {
				return err
			}
		}
		return nil
	})
}

// Update applies partial updates to an alert rule and replaces channel mappings.
func (r *AlertRuleRepository) Update(id string, req *models.AlertRuleUpdateRequest) error {
	return Transaction(func(tx *sql.Tx) error {
		// Build dynamic SET clause
		setClauses := []string{}
		args := []interface{}{}

		if req.Name != nil {
			setClauses = append(setClauses, "name = ?")
			args = append(args, *req.Name)
		}
		// Always update host_id and service_id (nil *string → SQL NULL, allows clearing)
		setClauses = append(setClauses, "host_id = ?")
		args = append(args, req.HostID)
		setClauses = append(setClauses, "service_id = ?")
		args = append(args, req.ServiceID)
		if req.Metric != nil {
			setClauses = append(setClauses, "metric = ?")
			args = append(args, string(*req.Metric))
		}
		if req.Operator != nil {
			setClauses = append(setClauses, "operator = ?")
			args = append(args, string(*req.Operator))
		}
		if req.Threshold != nil {
			setClauses = append(setClauses, "threshold = ?")
			args = append(args, *req.Threshold)
		}
		if req.Duration != nil {
			setClauses = append(setClauses, "duration = ?")
			args = append(args, *req.Duration)
		}
		if req.Severity != nil {
			setClauses = append(setClauses, "severity = ?")
			args = append(args, string(*req.Severity))
		}
		if req.IsEnabled != nil {
			enabled := 0
			if *req.IsEnabled {
				enabled = 1
			}
			setClauses = append(setClauses, "is_enabled = ?")
			args = append(args, enabled)
		}
		if req.Cooldown != nil {
			setClauses = append(setClauses, "cooldown = ?")
			args = append(args, *req.Cooldown)
		}
		if req.Message != nil {
			setClauses = append(setClauses, "message = ?")
			args = append(args, *req.Message)
		}

		// Always update updated_at
		setClauses = append(setClauses, "updated_at = ?")
		args = append(args, time.Now())
		args = append(args, id) // WHERE id = ?

		if len(setClauses) > 1 { // at least updated_at + one field
			query := "UPDATE alert_rules SET " + joinStrings(setClauses, ", ") + " WHERE id = ?"
			if _, err := tx.Exec(query, args...); err != nil {
				return err
			}
		}

		// Replace channel mappings if provided
		if req.ChannelIDs != nil {
			if _, err := tx.Exec(`DELETE FROM alert_rule_channels WHERE rule_id = ?`, id); err != nil {
				return err
			}
			for _, chID := range *req.ChannelIDs {
				if _, err := tx.Exec(`INSERT INTO alert_rule_channels (rule_id, channel_id) VALUES (?, ?)`,
					id, chID); err != nil {
					return err
				}
			}
		}

		return nil
	})
}

// Delete deletes an alert rule (CASCADE removes channel mappings).
func (r *AlertRuleRepository) Delete(id string) error {
	_, err := DB.Exec("DELETE FROM alert_rules WHERE id = ?", id)
	return err
}

// SetEnabled updates the is_enabled flag for an alert rule.
func (r *AlertRuleRepository) SetEnabled(id string, isEnabled bool) error {
	enabled := 0
	if isEnabled {
		enabled = 1
	}
	_, err := DB.Exec(`UPDATE alert_rules SET is_enabled = ?, updated_at = ? WHERE id = ?`,
		enabled, time.Now(), id)
	return err
}

// joinStrings joins a string slice with a separator (avoids importing strings package).
func joinStrings(elems []string, sep string) string {
	result := ""
	for i, e := range elems {
		if i > 0 {
			result += sep
		}
		result += e
	}
	return result
}
