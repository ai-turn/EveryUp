package database

import (
	"database/sql"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// ApiRequestRepository handles captured HTTP request metadata operations.
type ApiRequestRepository struct{}

// NewApiRequestRepository creates a new ApiRequestRepository.
func NewApiRequestRepository() *ApiRequestRepository {
	return &ApiRequestRepository{}
}

func scanApiRequest(
	id *int64,
	serviceID, requestID, method, path, pathTemplate *string,
	statusCode, durationMs *int,
	serviceName, traceID, spanID, route, clientIP, errStr *sql.NullString,
	isError *int,
	createdAt *time.Time,
) models.ApiRequest {
	req := models.ApiRequest{
		ID:           *id,
		ServiceID:    *serviceID,
		RequestID:    *requestID,
		Method:       *method,
		Path:         *path,
		PathTemplate: *pathTemplate,
		StatusCode:   *statusCode,
		DurationMs:   *durationMs,
		IsError:      *isError == 1,
		CreatedAt:    *createdAt,
	}
	if serviceName.Valid {
		req.ServiceName = serviceName.String
	}
	if traceID.Valid {
		req.TraceID = traceID.String
	}
	if spanID.Valid {
		req.SpanID = spanID.String
	}
	if route.Valid {
		req.Route = route.String
	}
	if clientIP.Valid {
		req.ClientIP = clientIP.String
	}
	if errStr.Valid {
		req.Error = errStr.String
	}
	return req
}

// Create inserts a new ApiRequest and sets req.ID from the auto-incremented row ID.
func (r *ApiRequestRepository) Create(req *models.ApiRequest) error {
	result, err := DB.Exec(`
		INSERT INTO api_requests
			(service_id, request_id, method, path, path_template,
			 status_code, duration_ms, client_ip,
			 error, is_error, created_at, trace_id, span_id, route, service_name)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		req.ServiceID, req.RequestID, req.Method, req.Path, req.PathTemplate,
		req.StatusCode, req.DurationMs, req.ClientIP,
		req.Error, boolToInt(req.IsError), req.CreatedAt,
		req.TraceID, req.SpanID, req.Route, req.ServiceName,
	)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	req.ID = id
	return nil
}

// CreateBatch inserts multiple ApiRequests in a single transaction.
// Returns the count of inserted rows.
func (r *ApiRequestRepository) CreateBatch(reqs []models.ApiRequest) (int, error) {
	if len(reqs) == 0 {
		return 0, nil
	}

	count := 0
	err := Transaction(func(tx *sql.Tx) error {
		stmt, err := tx.Prepare(`
			INSERT INTO api_requests
				(service_id, request_id, method, path, path_template,
				 status_code, duration_ms, client_ip,
				 error, is_error, created_at, trace_id, span_id, route, service_name)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)
		if err != nil {
			return err
		}
		defer stmt.Close()

		for _, req := range reqs {
			_, err := stmt.Exec(
				req.ServiceID, req.RequestID, req.Method, req.Path, req.PathTemplate,
				req.StatusCode, req.DurationMs, req.ClientIP,
				req.Error, boolToInt(req.IsError), req.CreatedAt,
				req.TraceID, req.SpanID, req.Route, req.ServiceName,
			)
			if err != nil {
				return err
			}
			count++
		}
		return nil
	})
	return count, err
}

// GetByID returns the ApiRequest with the given ID.
// Returns nil, nil if not found.
func (r *ApiRequestRepository) GetByID(id int64) (*models.ApiRequest, error) {
	var (
		statusCode, durationMs                                int
		isError                                               int
		rid64                                                 int64
		serviceID, requestID, method, path, pathTemplate      string
		serviceName, traceID, spanID, route, clientIP, errStr sql.NullString
		createdAt                                             time.Time
	)

	err := DB.QueryRow(`
		SELECT id, service_id, request_id, method, path, path_template,
		       status_code, duration_ms, client_ip,
		       error, is_error, created_at, trace_id, span_id, route, service_name
		FROM api_requests WHERE id = ?
	`, id).Scan(
		&rid64, &serviceID, &requestID, &method, &path, &pathTemplate,
		&statusCode, &durationMs, &clientIP,
		&errStr, &isError, &createdAt, &traceID, &spanID, &route, &serviceName,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	req := scanApiRequest(
		&rid64, &serviceID, &requestID, &method, &path, &pathTemplate,
		&statusCode, &durationMs, &serviceName, &traceID, &spanID, &route, &clientIP, &errStr, &isError, &createdAt,
	)
	return &req, nil
}

// GetByTraceID returns ApiRequest projections that share the given trace ID,
// ordered by creation time. Returns nil when none match.
func (r *ApiRequestRepository) GetByTraceID(traceID string) ([]models.ApiRequest, error) {
	if traceID == "" {
		return nil, nil
	}
	rows, err := DB.Query(`
		SELECT id, service_id, request_id, method, path, path_template,
		       status_code, duration_ms, client_ip,
		       error, is_error, created_at, trace_id, span_id, route, service_name
		FROM api_requests WHERE trace_id = ?
		ORDER BY created_at ASC
	`, traceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.ApiRequest
	for rows.Next() {
		var (
			statusCode, durationMs                                int
			isError                                               int
			rid64                                                 int64
			serviceID, requestID, method, path, pathTemplate      string
			serviceName, traceCol, spanID, route, clientIP, errStr sql.NullString
			createdAt                                             time.Time
		)
		if err := rows.Scan(
			&rid64, &serviceID, &requestID, &method, &path, &pathTemplate,
			&statusCode, &durationMs, &clientIP,
			&errStr, &isError, &createdAt, &traceCol, &spanID, &route, &serviceName,
		); err != nil {
			return nil, err
		}
		out = append(out, scanApiRequest(
			&rid64, &serviceID, &requestID, &method, &path, &pathTemplate,
			&statusCode, &durationMs, &serviceName, &traceCol, &spanID, &route, &clientIP, &errStr, &isError, &createdAt,
		))
	}
	return out, nil
}

// List returns a paginated, filtered list of ApiRequests and the total count.
// f.ServiceID is always applied. Other filters are optional (zero-value = skip).
func (r *ApiRequestRepository) List(f *models.ApiRequestFilter) ([]models.ApiRequest, int, error) {
	if f == nil {
		f = &models.ApiRequestFilter{}
	}

	where := "service_id = ?"
	args := []interface{}{f.ServiceID}

	if f.TraceID != "" {
		where += " AND trace_id = ?"
		args = append(args, f.TraceID)
	}
	if f.ErrorsOnly {
		where += " AND is_error = 1"
	}
	if f.MinStatus > 0 && f.MaxStatus > 0 {
		where += " AND status_code BETWEEN ? AND ?"
		args = append(args, f.MinStatus, f.MaxStatus)
	} else if f.MinStatus > 0 {
		where += " AND status_code >= ?"
		args = append(args, f.MinStatus)
	} else if f.MaxStatus > 0 {
		where += " AND status_code <= ?"
		args = append(args, f.MaxStatus)
	}
	if f.PathPrefix != "" {
		where += " AND path LIKE ?"
		args = append(args, f.PathPrefix+"%")
	}
	if f.Search != "" {
		where += " AND path LIKE ?"
		args = append(args, "%"+f.Search+"%")
	}
	if !f.From.IsZero() {
		where += " AND created_at >= ?"
		args = append(args, f.From)
	}
	if !f.To.IsZero() {
		where += " AND created_at <= ?"
		args = append(args, f.To)
	}
	if len(f.Methods) > 0 {
		placeholders := make([]string, len(f.Methods))
		for i, m := range f.Methods {
			placeholders[i] = "?"
			args = append(args, m)
		}
		where += " AND method IN (" + strings.Join(placeholders, ",") + ")"
	}

	var total int
	if err := DB.QueryRow("SELECT COUNT(*) FROM api_requests WHERE "+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	limit := f.Limit
	if limit <= 0 {
		limit = 50
	}
	dataQuery := "SELECT id, service_id, request_id, method, path, path_template," +
		" status_code, duration_ms, client_ip," +
		" error, is_error, created_at, trace_id, span_id, route, service_name" +
		" FROM api_requests WHERE " + where +
		" ORDER BY created_at DESC LIMIT ?"
	dataArgs := append(args, limit)
	if f.Offset > 0 {
		dataQuery += " OFFSET ?"
		dataArgs = append(dataArgs, f.Offset)
	}

	rows, err := DB.Query(dataQuery, dataArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var items []models.ApiRequest
	for rows.Next() {
		var (
			statusCode, durationMs                                int
			id64                                                  int64
			isError                                               int
			serviceID, requestID, method, path, pathTemplate      string
			serviceName, traceID, spanID, route, clientIP, errStr sql.NullString
			createdAt                                             time.Time
		)
		if err := rows.Scan(
			&id64, &serviceID, &requestID, &method, &path, &pathTemplate,
			&statusCode, &durationMs, &clientIP,
			&errStr, &isError, &createdAt, &traceID, &spanID, &route, &serviceName,
		); err != nil {
			return nil, 0, err
		}
		items = append(items, scanApiRequest(
			&id64, &serviceID, &requestID, &method, &path, &pathTemplate,
			&statusCode, &durationMs, &serviceName, &traceID, &spanID, &route, &clientIP, &errStr, &isError, &createdAt,
		))
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

// DeleteOlderThan deletes all api_requests created before cutoff.
// Returns the number of rows deleted.
func (r *ApiRequestRepository) DeleteOlderThan(cutoff time.Time) (int64, error) {
	result, err := DB.Exec(`DELETE FROM api_requests WHERE created_at < ?`, cutoff)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// boolToInt converts a bool to 0/1 for SQLite storage.
func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
