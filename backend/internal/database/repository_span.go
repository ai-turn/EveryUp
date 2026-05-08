package database

import (
	"database/sql"

	"github.com/aiturn/everyup/internal/models"
)

// SpanRepository handles OpenTelemetry span persistence.
type SpanRepository struct{}

// NewSpanRepository creates a new span repository.
func NewSpanRepository() *SpanRepository {
	return &SpanRepository{}
}

// CreateBatch inserts spans and ignores duplicate trace_id/span_id pairs.
func (r *SpanRepository) CreateBatch(spans []models.Span) (int, error) {
	if len(spans) == 0 {
		return 0, nil
	}

	count := 0
	err := Transaction(func(tx *sql.Tx) error {
		stmt, err := tx.Prepare(`
			INSERT OR IGNORE INTO spans (
				service_id, service_name, trace_id, span_id, parent_span_id,
				name, kind, start_unix_nano, end_unix_nano, duration_ms,
				status_code, status_message, attributes, events, links, resource, created_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)
		if err != nil {
			return err
		}
		defer stmt.Close()

		for _, span := range spans {
			result, err := stmt.Exec(
				span.ServiceID, span.ServiceName, span.TraceID, span.SpanID, span.ParentSpanID,
				span.Name, span.Kind, span.StartUnixNano, span.EndUnixNano, span.DurationMs,
				span.StatusCode, span.StatusMessage, span.Attributes, span.Events, span.Links, span.Resource, span.CreatedAt,
			)
			if err != nil {
				return err
			}
			if affected, _ := result.RowsAffected(); affected > 0 {
				count++
			}
		}
		return nil
	})
	return count, err
}

// GetByTraceID returns spans that share the given trace ID, ordered by start
// time. Returns nil when none match.
func (r *SpanRepository) GetByTraceID(traceID string) ([]models.Span, error) {
	if traceID == "" {
		return nil, nil
	}
	rows, err := DB.Query(`
		SELECT id, service_id, service_name, trace_id, span_id, parent_span_id,
			name, kind, start_unix_nano, end_unix_nano, duration_ms,
			status_code, status_message, attributes, events, links, resource, created_at
		FROM spans WHERE trace_id = ?
		ORDER BY start_unix_nano ASC
	`, traceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var spans []models.Span
	for rows.Next() {
		var s models.Span
		var attributes, events, links, resource sql.NullString
		if err := rows.Scan(
			&s.ID, &s.ServiceID, &s.ServiceName, &s.TraceID, &s.SpanID, &s.ParentSpanID,
			&s.Name, &s.Kind, &s.StartUnixNano, &s.EndUnixNano, &s.DurationMs,
			&s.StatusCode, &s.StatusMessage, &attributes, &events, &links, &resource, &s.CreatedAt,
		); err != nil {
			return nil, err
		}
		if attributes.Valid {
			s.Attributes = []byte(attributes.String)
		}
		if events.Valid {
			s.Events = []byte(events.String)
		}
		if links.Valid {
			s.Links = []byte(links.String)
		}
		if resource.Valid {
			s.Resource = []byte(resource.String)
		}
		spans = append(spans, s)
	}
	return spans, nil
}
