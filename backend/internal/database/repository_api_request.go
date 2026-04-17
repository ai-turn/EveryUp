package database

import (
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// ApiRequestRepository handles captured HTTP request/response pair operations.
type ApiRequestRepository struct{}

// NewApiRequestRepository creates a new ApiRequestRepository.
func NewApiRequestRepository() *ApiRequestRepository {
	return &ApiRequestRepository{}
}

// scanApiRequest scans a single row into an ApiRequest.
// reqHeaders and resHeaders are stored as JSON TEXT (nullable) in SQLite.
func scanApiRequest(
	id *int64,
	serviceID, requestID, method, path, pathTemplate *string,
	statusCode, durationMs *int,
	clientIP *sql.NullString,
	reqHeadersRaw, reqBody *sql.NullString,
	reqBodySize *int,
	resHeadersRaw, resBody *sql.NullString,
	resBodySize *int,
	errStr *sql.NullString,
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
		ReqBodySize:  *reqBodySize,
		ResBodySize:  *resBodySize,
		IsError:      *isError == 1,
		CreatedAt:    *createdAt,
	}
	if clientIP.Valid {
		req.ClientIP = clientIP.String
	}
	if reqHeadersRaw.Valid && reqHeadersRaw.String != "" {
		req.ReqHeaders = json.RawMessage(reqHeadersRaw.String)
	}
	if reqBody.Valid {
		req.ReqBody = reqBody.String
	}
	if resHeadersRaw.Valid && resHeadersRaw.String != "" {
		req.ResHeaders = json.RawMessage(resHeadersRaw.String)
	}
	if resBody.Valid {
		req.ResBody = resBody.String
	}
	if errStr.Valid {
		req.Error = errStr.String
	}
	return req
}

// Create inserts a new ApiRequest and sets req.ID from the auto-incremented row ID.
func (r *ApiRequestRepository) Create(req *models.ApiRequest) error {
	var reqHeadersJSON, resHeadersJSON *string
	if len(req.ReqHeaders) > 0 {
		s := string(req.ReqHeaders)
		reqHeadersJSON = &s
	}
	if len(req.ResHeaders) > 0 {
		s := string(req.ResHeaders)
		resHeadersJSON = &s
	}

	result, err := DB.Exec(`
		INSERT INTO api_requests
			(service_id, request_id, method, path, path_template,
			 status_code, duration_ms, client_ip,
			 req_headers, req_body, req_body_size,
			 res_headers, res_body, res_body_size,
			 error, is_error, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		req.ServiceID, req.RequestID, req.Method, req.Path, req.PathTemplate,
		req.StatusCode, req.DurationMs, req.ClientIP,
		reqHeadersJSON, req.ReqBody, req.ReqBodySize,
		resHeadersJSON, req.ResBody, req.ResBodySize,
		req.Error, boolToInt(req.IsError), req.CreatedAt,
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
				 req_headers, req_body, req_body_size,
				 res_headers, res_body, res_body_size,
				 error, is_error, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)
		if err != nil {
			return err
		}
		defer stmt.Close()

		for _, req := range reqs {
			var reqHeadersJSON, resHeadersJSON *string
			if len(req.ReqHeaders) > 0 {
				s := string(req.ReqHeaders)
				reqHeadersJSON = &s
			}
			if len(req.ResHeaders) > 0 {
				s := string(req.ResHeaders)
				resHeadersJSON = &s
			}

			_, err := stmt.Exec(
				req.ServiceID, req.RequestID, req.Method, req.Path, req.PathTemplate,
				req.StatusCode, req.DurationMs, req.ClientIP,
				reqHeadersJSON, req.ReqBody, req.ReqBodySize,
				resHeadersJSON, req.ResBody, req.ResBodySize,
				req.Error, boolToInt(req.IsError), req.CreatedAt,
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
		statusCode, durationMs, reqBodySize, resBodySize int
		isError                                          int
		rid64                                            int64
		serviceID, requestID, method, path, pathTemplate string
		clientIP, reqHeadersRaw, reqBody                 sql.NullString
		resHeadersRaw, resBody, errStr                   sql.NullString
		createdAt                                        time.Time
	)

	err := DB.QueryRow(`
		SELECT id, service_id, request_id, method, path, path_template,
		       status_code, duration_ms, client_ip,
		       req_headers, req_body, req_body_size,
		       res_headers, res_body, res_body_size,
		       error, is_error, created_at
		FROM api_requests WHERE id = ?
	`, id).Scan(
		&rid64, &serviceID, &requestID, &method, &path, &pathTemplate,
		&statusCode, &durationMs, &clientIP,
		&reqHeadersRaw, &reqBody, &reqBodySize,
		&resHeadersRaw, &resBody, &resBodySize,
		&errStr, &isError, &createdAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	req := scanApiRequest(
		&rid64, &serviceID, &requestID, &method, &path, &pathTemplate,
		&statusCode, &durationMs,
		&clientIP,
		&reqHeadersRaw, &reqBody, &reqBodySize,
		&resHeadersRaw, &resBody, &resBodySize,
		&errStr, &isError, &createdAt,
	)
	return &req, nil
}

// List returns a paginated, filtered list of ApiRequests and the total count.
// f.ServiceID is always applied. Other filters are optional (zero-value = skip).
func (r *ApiRequestRepository) List(f *models.ApiRequestFilter) ([]models.ApiRequest, int, error) {
	if f == nil {
		f = &models.ApiRequestFilter{}
	}

	// Build WHERE clause (shared between count and data queries).
	where := "service_id = ?"
	args := []interface{}{f.ServiceID}

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
		where += " AND (path LIKE ? OR req_body LIKE ? OR res_body LIKE ?)"
		q := "%" + f.Search + "%"
		args = append(args, q, q, q)
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

	// Count query (no LIMIT/OFFSET, no ORDER BY).
	var total int
	countQuery := "SELECT COUNT(*) FROM api_requests WHERE " + where
	if err := DB.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Data query.
	limit := f.Limit
	if limit <= 0 {
		limit = 50
	}
	dataQuery := "SELECT id, service_id, request_id, method, path, path_template," +
		" status_code, duration_ms, client_ip," +
		" req_headers, req_body, req_body_size," +
		" res_headers, res_body, res_body_size," +
		" error, is_error, created_at" +
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
			statusCode, durationMs, reqBodySize, resBodySize int
			id64                                             int64
			isError                                          int
			serviceID, requestID, method, path, pathTemplate string
			clientIP, reqHeadersRaw, reqBody                 sql.NullString
			resHeadersRaw, resBody, errStr                   sql.NullString
			createdAt                                        time.Time
		)
		if err := rows.Scan(
			&id64, &serviceID, &requestID, &method, &path, &pathTemplate,
			&statusCode, &durationMs, &clientIP,
			&reqHeadersRaw, &reqBody, &reqBodySize,
			&resHeadersRaw, &resBody, &resBodySize,
			&errStr, &isError, &createdAt,
		); err != nil {
			return nil, 0, err
		}

		req := scanApiRequest(
			&id64, &serviceID, &requestID, &method, &path, &pathTemplate,
			&statusCode, &durationMs,
			&clientIP,
			&reqHeadersRaw, &reqBody, &reqBodySize,
			&resHeadersRaw, &resBody, &resBodySize,
			&errStr, &isError, &createdAt,
		)
		items = append(items, req)
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
