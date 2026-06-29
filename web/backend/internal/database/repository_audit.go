package database

import (
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// AuditRepository persists sensitive user-action audit events.
type AuditRepository struct{}

// NewAuditRepository creates a new audit repository.
func NewAuditRepository() *AuditRepository {
	return &AuditRepository{}
}

// Create inserts an audit event.
func (r *AuditRepository) Create(event *models.AuditEvent) error {
	if event == nil {
		return nil
	}
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now()
	}
	result, err := DB.Exec(`
		INSERT INTO audit_events (user_id, username, action, trace_id, metadata, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, event.UserID, event.Username, event.Action, event.TraceID, event.Metadata, event.CreatedAt)
	if err != nil {
		return err
	}
	if id, err := result.LastInsertId(); err == nil {
		event.ID = id
	}
	return nil
}

// GetRecent returns the most recent audit events, newest first. An optional
// action filter narrows to a single action type when non-empty.
func (r *AuditRepository) GetRecent(action string, limit int) ([]models.AuditEvent, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	query := `SELECT id, user_id, username, action, trace_id, metadata, created_at FROM audit_events`
	args := []interface{}{}
	if action != "" {
		query += ` WHERE action = ?`
		args = append(args, action)
	}
	query += ` ORDER BY created_at DESC, id DESC LIMIT ?`
	args = append(args, limit)

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := []models.AuditEvent{}
	for rows.Next() {
		var e models.AuditEvent
		if err := rows.Scan(&e.ID, &e.UserID, &e.Username, &e.Action, &e.TraceID, &e.Metadata, &e.CreatedAt); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, rows.Err()
}

// DeleteOlderThan removes audit events older than the cutoff.
func (r *AuditRepository) DeleteOlderThan(cutoff time.Time) (int64, error) {
	result, err := DB.Exec(`DELETE FROM audit_events WHERE created_at < ?`, cutoff)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
