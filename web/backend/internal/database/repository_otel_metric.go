package database

import (
	"database/sql"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// OtelMetricRepository handles OTLP metric data point persistence.
type OtelMetricRepository struct{}

// NewOtelMetricRepository creates a new OTLP metric repository.
func NewOtelMetricRepository() *OtelMetricRepository {
	return &OtelMetricRepository{}
}

// CreateBatch inserts metric data points.
func (r *OtelMetricRepository) CreateBatch(metrics []models.OtelMetric) (int, error) {
	if len(metrics) == 0 {
		return 0, nil
	}

	count := 0
	err := Transaction(func(tx *sql.Tx) error {
		stmt, err := tx.Prepare(`
			INSERT INTO otel_metrics (
				service_id, agent_id, service_name, metric_name, metric_type, unit,
				attributes, value, count, total, time_unix_nano, created_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)
		if err != nil {
			return err
		}
		defer stmt.Close()

		for _, m := range metrics {
			if _, err := stmt.Exec(
				m.ServiceID, m.AgentID, m.ServiceName, m.MetricName, m.MetricType, m.Unit,
				m.Attributes, m.Value, m.Count, m.Total, m.TimeUnixNano, m.CreatedAt,
			); err != nil {
				return err
			}
			count++
		}
		return nil
	})
	return count, err
}

// ListNames returns the distinct metrics matching the filter scope, newest
// first, for the metric picker. last_at reads the bare created_at column of
// each group's newest row: the modernc driver only maps DATETIME to time.Time
// when the value traces back to the declared column type — MAX(created_at)
// strips that (see repository_notification.go).
func (r *OtelMetricRepository) ListNames(f *models.OtelMetricFilter) ([]models.OtelMetricName, error) {
	where, args := otelMetricScope(f)
	rows, err := DB.Query(`
		SELECT metric_name, metric_type, unit, created_at AS last_at
		FROM otel_metrics
		WHERE id IN (
			SELECT MAX(id) FROM otel_metrics
			WHERE `+where+`
			GROUP BY metric_name, metric_type, unit
		)
		ORDER BY created_at DESC
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var names []models.OtelMetricName
	for rows.Next() {
		var n models.OtelMetricName
		if err := rows.Scan(&n.MetricName, &n.MetricType, &n.Unit, &n.LastAt); err != nil {
			return nil, err
		}
		names = append(names, n)
	}
	return names, rows.Err()
}

// ListPoints returns data points for one metric in the filter scope, oldest
// first (chart order).
func (r *OtelMetricRepository) ListPoints(f *models.OtelMetricFilter) ([]models.OtelMetric, error) {
	where, args := otelMetricScope(f)
	where += " AND metric_name = ?"
	args = append(args, f.MetricName)
	if !f.From.IsZero() {
		where += " AND created_at >= ?"
		args = append(args, f.From)
	}
	if !f.To.IsZero() {
		where += " AND created_at <= ?"
		args = append(args, f.To)
	}
	limit := f.Limit
	if limit <= 0 || limit > 5000 {
		limit = 5000
	}
	args = append(args, limit)

	// Newest N points selected, then re-sorted ascending for the chart.
	rows, err := DB.Query(`
		SELECT * FROM (
			SELECT id, service_id, agent_id, service_name, metric_name, metric_type, unit,
				attributes, value, count, total, time_unix_nano, created_at
			FROM otel_metrics
			WHERE `+where+`
			ORDER BY created_at DESC
			LIMIT ?
		) ORDER BY created_at ASC
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var points []models.OtelMetric
	for rows.Next() {
		var m models.OtelMetric
		var attributes sql.NullString
		if err := rows.Scan(
			&m.ID, &m.ServiceID, &m.AgentID, &m.ServiceName, &m.MetricName, &m.MetricType, &m.Unit,
			&attributes, &m.Value, &m.Count, &m.Total, &m.TimeUnixNano, &m.CreatedAt,
		); err != nil {
			return nil, err
		}
		if attributes.Valid {
			m.Attributes = []byte(attributes.String)
		}
		points = append(points, m)
	}
	return points, rows.Err()
}

// LatestValuesByService returns the latest value of each metric every service
// under the agent has exported since the cutoff — one row per
// (service_name, metric_name), newest point per group. The caller picks each
// service's representative metric from these. ponytail: a metric with multiple
// attribute series collapses to whichever series holds the newest id; a glance
// card doesn't need per-series aggregation.
func (r *OtelMetricRepository) LatestValuesByService(agentID string, since time.Time) ([]models.OtelServiceMetric, error) {
	rows, err := DB.Query(`
		SELECT service_name, metric_name, metric_type, unit, value
		FROM otel_metrics
		WHERE id IN (
			SELECT MAX(id) FROM otel_metrics
			WHERE agent_id = ? AND created_at >= ?
			GROUP BY service_name, metric_name
		)
	`, agentID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.OtelServiceMetric
	for rows.Next() {
		var m models.OtelServiceMetric
		if err := rows.Scan(&m.ServiceName, &m.MetricName, &m.MetricType, &m.Unit, &m.Value); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// DeleteOlderThan removes metric points older than the cutoff.
func (r *OtelMetricRepository) DeleteOlderThan(cutoff time.Time) (int64, error) {
	result, err := DB.Exec(`DELETE FROM otel_metrics WHERE created_at < ?`, cutoff)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func otelMetricScope(f *models.OtelMetricFilter) (string, []interface{}) {
	if f.AgentID != "" {
		return "agent_id = ? AND service_name = ?", []interface{}{f.AgentID, f.ServiceName}
	}
	return "service_id = ?", []interface{}{f.ServiceID}
}
