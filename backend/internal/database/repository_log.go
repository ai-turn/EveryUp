package database

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// LogRepository handles log data operations
type LogRepository struct{}

// NewLogRepository creates a new log repository
func NewLogRepository() *LogRepository {
	return &LogRepository{}
}

// Create creates a new log entry
func (r *LogRepository) Create(l *models.Log) error {
	if l.Source == "" {
		l.Source = models.LogSourceInternal
	}

	result, err := DB.Exec(`
		INSERT INTO logs (service_id, level, message, metadata, source, fingerprint, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, l.ServiceID, l.Level, l.Message, l.Metadata, l.Source, l.Fingerprint, l.CreatedAt)
	if err != nil {
		return err
	}

	id, _ := result.LastInsertId()
	l.ID = id
	return nil
}

// GetAll returns logs with optional filters
func (r *LogRepository) GetAll(filter models.LogFilter) ([]models.Log, int, error) {
	// Build query — JOIN services to include service name
	baseWhere := " FROM logs l LEFT JOIN services s ON s.id = l.service_id WHERE 1=1"
	query := "SELECT l.id, l.service_id, COALESCE(s.name, l.service_id, ''), l.level, l.message, l.metadata, l.created_at" + baseWhere
	countQuery := "SELECT COUNT(*)" + baseWhere
	args := []interface{}{}

	if filter.ServiceID != "" {
		query += " AND l.service_id = ?"
		countQuery += " AND l.service_id = ?"
		args = append(args, filter.ServiceID)
	}
	if filter.Level != "" {
		query += " AND l.level = ?"
		countQuery += " AND l.level = ?"
		args = append(args, filter.Level)
	}
	if filter.Search != "" {
		query += " AND l.message LIKE ?"
		countQuery += " AND l.message LIKE ?"
		args = append(args, "%"+filter.Search+"%")
	}
	if !filter.From.IsZero() {
		query += " AND l.created_at >= ?"
		countQuery += " AND l.created_at >= ?"
		args = append(args, filter.From)
	}
	if !filter.To.IsZero() {
		query += " AND l.created_at <= ?"
		countQuery += " AND l.created_at <= ?"
		args = append(args, filter.To)
	}

	// Get total count
	var total int
	if err := DB.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Add pagination
	query += " ORDER BY l.created_at DESC"
	if filter.Limit > 0 {
		query += " LIMIT ?"
		args = append(args, filter.Limit)
	}
	if filter.Offset > 0 {
		query += " OFFSET ?"
		args = append(args, filter.Offset)
	}

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var logs []models.Log
	for rows.Next() {
		var l models.Log
		var serviceID, serviceName, metadata sql.NullString
		if err := rows.Scan(&l.ID, &serviceID, &serviceName, &l.Level, &l.Message, &metadata, &l.CreatedAt); err != nil {
			return nil, 0, err
		}
		if serviceID.Valid {
			l.ServiceID = serviceID.String
		}
		if serviceName.Valid {
			l.ServiceName = serviceName.String
		}
		if metadata.Valid {
			l.Metadata = json.RawMessage(metadata.String)
		}
		logs = append(logs, l)
	}
	return logs, total, nil
}

// DeleteOld deletes logs older than the specified duration
func (r *LogRepository) DeleteOld(retention time.Duration) (int64, error) {
	result, err := DB.Exec(`
		DELETE FROM logs WHERE created_at < ?
	`, time.Now().Add(-retention))
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
