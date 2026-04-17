package database

import (
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/crypto"
	"github.com/aiturn/everyup/internal/models"
)

// ServiceRepository handles service data operations
type ServiceRepository struct{}

// NewServiceRepository creates a new service repository
func NewServiceRepository() *ServiceRepository {
	return &ServiceRepository{}
}

// unmarshalLogLevelFilter parses a nullable JSON string into []models.LogLevel.
// Returns nil if the column is NULL or empty (= accept all levels).
func unmarshalLogLevelFilter(col sql.NullString) []models.LogLevel {
	if !col.Valid || col.String == "" || col.String == "[]" || col.String == "null" {
		return nil
	}
	var levels []models.LogLevel
	json.Unmarshal([]byte(col.String), &levels)
	return levels
}

// marshalLogLevelFilter serialises []models.LogLevel to a JSON string for storage.
// nil / empty slice → NULL (accept all).
func marshalLogLevelFilter(filter []models.LogLevel) interface{} {
	if len(filter) == 0 {
		return nil
	}
	b, _ := json.Marshal(filter)
	return string(b)
}

// GetAll returns all services, optionally filtered by type.
// Example: GetAll("http", "tcp") returns only http and tcp services.
// Call with no arguments to return all services.
func (r *ServiceRepository) GetAll(typeFilter ...string) ([]models.Service, error) {
	query := `SELECT id, name, type, is_active, url, port, method, headers, body,
		       expected_status, interval, timeout, tags, schedule_type, cron_expression,
		       api_key_masked, log_level_filter, created_at, updated_at
		FROM services`

	var args []interface{}
	if len(typeFilter) > 0 {
		placeholders := make([]string, len(typeFilter))
		for i, t := range typeFilter {
			placeholders[i] = "?"
			args = append(args, t)
		}
		query += " WHERE type IN (" + strings.Join(placeholders, ",") + ")"
	}
	query += " ORDER BY name"

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var services []models.Service
	for rows.Next() {
		var s models.Service
		var isActive int
		var url, method, headers, body, tags, scheduleType, cronExpression sql.NullString
		var port, expectedStatus, interval, timeout sql.NullInt64
		var apiKeyMasked, logLevelFilter sql.NullString
		if err := rows.Scan(&s.ID, &s.Name, &s.Type, &isActive, &url, &port, &method, &headers, &body,
			&expectedStatus, &interval, &timeout, &tags, &scheduleType, &cronExpression,
			&apiKeyMasked, &logLevelFilter, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		s.IsActive = isActive == 1
		if url.Valid {
			s.URL = url.String
		}
		if port.Valid {
			s.Port = int(port.Int64)
		}
		if method.Valid {
			s.Method = method.String
		}
		if headers.Valid && headers.String != "" {
			json.Unmarshal([]byte(headers.String), &s.Headers)
		}
		if body.Valid {
			s.Body = body.String
		}
		if expectedStatus.Valid {
			s.ExpectedStatus = int(expectedStatus.Int64)
		}
		if interval.Valid {
			s.Interval = int(interval.Int64)
		}
		if timeout.Valid {
			s.Timeout = int(timeout.Int64)
		}
		if tags.Valid && tags.String != "" {
			json.Unmarshal([]byte(tags.String), &s.Tags)
		}
		if scheduleType.Valid {
			s.ScheduleType = models.ScheduleType(scheduleType.String)
		} else {
			s.ScheduleType = models.ScheduleTypeInterval
		}
		if cronExpression.Valid {
			s.CronExpression = cronExpression.String
		}
		if apiKeyMasked.Valid {
			s.ApiKeyMasked = apiKeyMasked.String
		}
		s.LogLevelFilter = unmarshalLogLevelFilter(logLevelFilter)
		s.Status = models.StatusUnknown
		services = append(services, s)
	}
	return services, nil
}

// GetByID returns a service by ID
func (r *ServiceRepository) GetByID(id string) (*models.Service, error) {
	var s models.Service
	var isActive int
	var url, method, headers, body, tags, scheduleType, cronExpression sql.NullString
	var port, expectedStatus, interval, timeout sql.NullInt64
	var apiKeyHash, apiKeyMasked, logLevelFilter sql.NullString

	err := DB.QueryRow(`
		SELECT id, name, type, is_active, url, port, method, headers, body,
		       expected_status, interval, timeout, tags, schedule_type, cron_expression,
		       api_key, api_key_masked, log_level_filter, created_at, updated_at
		FROM services WHERE id = ?
	`, id).Scan(&s.ID, &s.Name, &s.Type, &isActive, &url, &port, &method, &headers, &body,
		&expectedStatus, &interval, &timeout, &tags, &scheduleType, &cronExpression,
		&apiKeyHash, &apiKeyMasked, &logLevelFilter, &s.CreatedAt, &s.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	s.IsActive = isActive == 1
	if url.Valid {
		s.URL = url.String
	}
	if port.Valid {
		s.Port = int(port.Int64)
	}
	if method.Valid {
		s.Method = method.String
	}
	if headers.Valid && headers.String != "" {
		json.Unmarshal([]byte(headers.String), &s.Headers)
	}
	if body.Valid {
		s.Body = body.String
	}
	if expectedStatus.Valid {
		s.ExpectedStatus = int(expectedStatus.Int64)
	}
	if interval.Valid {
		s.Interval = int(interval.Int64)
	}
	if timeout.Valid {
		s.Timeout = int(timeout.Int64)
	}
	if tags.Valid && tags.String != "" {
		json.Unmarshal([]byte(tags.String), &s.Tags)
	}
	if scheduleType.Valid {
		s.ScheduleType = models.ScheduleType(scheduleType.String)
	} else {
		s.ScheduleType = models.ScheduleTypeInterval
	}
	if cronExpression.Valid {
		s.CronExpression = cronExpression.String
	}
	if apiKeyHash.Valid {
		s.ApiKey = apiKeyHash.String // hash — used internally for cache invalidation
	}
	if apiKeyMasked.Valid {
		s.ApiKeyMasked = apiKeyMasked.String
	}
	s.LogLevelFilter = unmarshalLogLevelFilter(logLevelFilter)
	s.Status = models.StatusUnknown

	return &s, nil
}

// Create creates a new service
func (r *ServiceRepository) Create(s *models.Service) error {
	var headersJSON, tagsJSON []byte
	var err error

	if s.Headers != nil {
		headersJSON, err = json.Marshal(s.Headers)
		if err != nil {
			return err
		}
	}
	if s.Tags != nil {
		tagsJSON, err = json.Marshal(s.Tags)
		if err != nil {
			return err
		}
	}

	isActive := 0
	if s.IsActive {
		isActive = 1
	}

	// Default to "interval" if not set
	scheduleType := string(s.ScheduleType)
	if scheduleType == "" {
		scheduleType = string(models.ScheduleTypeInterval)
	}

	_, err = DB.Exec(`
		INSERT INTO services (id, name, type, is_active, url, port, method, headers, body,
		                      expected_status, interval, timeout, tags, schedule_type, cron_expression,
		                      api_key, api_key_masked, log_level_filter, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, s.ID, s.Name, s.Type, isActive, s.URL, s.Port, s.Method, string(headersJSON), s.Body,
		s.ExpectedStatus, s.Interval, s.Timeout, string(tagsJSON), scheduleType, s.CronExpression,
		crypto.HashApiKey(s.ApiKey), s.ApiKeyMasked, marshalLogLevelFilter(s.LogLevelFilter),
		s.CreatedAt, s.UpdatedAt)
	return err
}

// UpdateApiKey updates the api_key (SHA-256 hash) and api_key_masked fields of a service.
func (r *ServiceRepository) UpdateApiKey(id, apiKeyHash, apiKeyMasked string) error {
	_, err := DB.Exec(`UPDATE services SET api_key = ?, api_key_masked = ?, updated_at = ? WHERE id = ?`,
		apiKeyHash, apiKeyMasked, time.Now(), id)
	return err
}

// Update updates a service
func (r *ServiceRepository) Update(s *models.Service) error {
	var headersJSON, tagsJSON []byte
	var err error

	if s.Headers != nil {
		headersJSON, err = json.Marshal(s.Headers)
		if err != nil {
			return err
		}
	}
	if s.Tags != nil {
		tagsJSON, err = json.Marshal(s.Tags)
		if err != nil {
			return err
		}
	}

	isActive := 0
	if s.IsActive {
		isActive = 1
	}

	// Default to "interval" if not set
	scheduleType := string(s.ScheduleType)
	if scheduleType == "" {
		scheduleType = string(models.ScheduleTypeInterval)
	}

	s.UpdatedAt = time.Now()
	_, err = DB.Exec(`
		UPDATE services SET name = ?, type = ?, is_active = ?, url = ?, port = ?, method = ?,
		                    headers = ?, body = ?, expected_status = ?, interval = ?, timeout = ?,
		                    tags = ?, schedule_type = ?, cron_expression = ?,
		                    log_level_filter = ?, updated_at = ?
		WHERE id = ?
	`, s.Name, s.Type, isActive, s.URL, s.Port, s.Method, string(headersJSON), s.Body,
		s.ExpectedStatus, s.Interval, s.Timeout, string(tagsJSON), scheduleType, s.CronExpression,
		marshalLogLevelFilter(s.LogLevelFilter), s.UpdatedAt, s.ID)
	return err
}

// GetActive returns all active services (is_active = 1)
func (r *ServiceRepository) GetActive() ([]models.Service, error) {
	rows, err := DB.Query(`
		SELECT id, name, type, is_active, url, port, method, headers, body,
		       expected_status, interval, timeout, tags, schedule_type, cron_expression,
		       created_at, updated_at
		FROM services
		WHERE is_active = 1
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var services []models.Service
	for rows.Next() {
		var s models.Service
		var isActive int
		var url, method, headers, body, tags, scheduleType, cronExpression sql.NullString
		var port, expectedStatus, interval, timeout sql.NullInt64
		if err := rows.Scan(&s.ID, &s.Name, &s.Type, &isActive, &url, &port, &method, &headers, &body,
			&expectedStatus, &interval, &timeout, &tags, &scheduleType, &cronExpression,
			&s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		s.IsActive = isActive == 1
		if url.Valid {
			s.URL = url.String
		}
		if port.Valid {
			s.Port = int(port.Int64)
		}
		if method.Valid {
			s.Method = method.String
		}
		if headers.Valid && headers.String != "" {
			json.Unmarshal([]byte(headers.String), &s.Headers)
		}
		if body.Valid {
			s.Body = body.String
		}
		if expectedStatus.Valid {
			s.ExpectedStatus = int(expectedStatus.Int64)
		}
		if interval.Valid {
			s.Interval = int(interval.Int64)
		}
		if timeout.Valid {
			s.Timeout = int(timeout.Int64)
		}
		if tags.Valid && tags.String != "" {
			json.Unmarshal([]byte(tags.String), &s.Tags)
		}
		if scheduleType.Valid {
			s.ScheduleType = models.ScheduleType(scheduleType.String)
		} else {
			s.ScheduleType = models.ScheduleTypeInterval
		}
		if cronExpression.Valid {
			s.CronExpression = cronExpression.String
		}
		s.Status = models.StatusUnknown
		services = append(services, s)
	}
	return services, nil
}

// SetActive sets the is_active flag for a service
func (r *ServiceRepository) SetActive(id string, isActive bool) error {
	active := 0
	if isActive {
		active = 1
	}
	_, err := DB.Exec(`UPDATE services SET is_active = ?, updated_at = ? WHERE id = ?`,
		active, time.Now(), id)
	return err
}

// GetByApiKeyHash returns a service by its pre-hashed API key.
// Includes log_level_filter so the ingest handler can apply per-service filtering.
func (r *ServiceRepository) GetByApiKeyHash(apiKeyHash string) (*models.Service, error) {
	if apiKeyHash == "" {
		return nil, nil
	}
	var s models.Service
	var isActive int
	var url, method, body sql.NullString
	var port, expectedStatus, interval, timeout sql.NullInt64
	var headersJSON, tagsJSON, logLevelFilter sql.NullString

	err := DB.QueryRow(`
		SELECT id, name, type, is_active, url, port, method, headers, body,
		       expected_status, interval, timeout, tags, log_level_filter, created_at, updated_at
		FROM services WHERE api_key = ?
	`, apiKeyHash).Scan(&s.ID, &s.Name, &s.Type, &isActive, &url, &port, &method,
		&headersJSON, &body, &expectedStatus, &interval, &timeout,
		&tagsJSON, &logLevelFilter, &s.CreatedAt, &s.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	s.IsActive = isActive == 1
	if url.Valid {
		s.URL = url.String
	}
	if port.Valid {
		s.Port = int(port.Int64)
	}
	if method.Valid {
		s.Method = method.String
	}
	if body.Valid {
		s.Body = body.String
	}
	if expectedStatus.Valid {
		s.ExpectedStatus = int(expectedStatus.Int64)
	}
	if interval.Valid {
		s.Interval = int(interval.Int64)
	}
	if timeout.Valid {
		s.Timeout = int(timeout.Int64)
	}
	if headersJSON.Valid && headersJSON.String != "" {
		json.Unmarshal([]byte(headersJSON.String), &s.Headers)
	}
	if tagsJSON.Valid && tagsJSON.String != "" {
		json.Unmarshal([]byte(tagsJSON.String), &s.Tags)
	}
	s.LogLevelFilter = unmarshalLogLevelFilter(logLevelFilter)

	return &s, nil
}

// GetAllApiKeyMappings returns a map of api_key hash → service for cache warm-up.
// Includes log_level_filter so the cached service can apply per-service filtering.
func (r *ServiceRepository) GetAllApiKeyMappings() (map[string]*models.Service, error) {
	rows, err := DB.Query(`
		SELECT id, name, type, is_active, api_key, log_level_filter
		FROM services WHERE api_key != ''
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]*models.Service)
	for rows.Next() {
		var s models.Service
		var isActive int
		var apiKeyHash string
		var logLevelFilter sql.NullString
		if err := rows.Scan(&s.ID, &s.Name, &s.Type, &isActive, &apiKeyHash, &logLevelFilter); err != nil {
			return nil, err
		}
		s.IsActive = isActive == 1
		s.LogLevelFilter = unmarshalLogLevelFilter(logLevelFilter)
		svc := s
		result[apiKeyHash] = &svc
	}
	return result, nil
}

// Delete deletes a service
func (r *ServiceRepository) Delete(id string) error {
	_, err := DB.Exec("DELETE FROM services WHERE id = ?", id)
	return err
}

// GetApiCaptureConfig returns the API capture configuration for the given service.
// If all capture columns are NULL, it returns DefaultApiCaptureConfig().
// If partially set, non-NULL values override the defaults.
func (r *ServiceRepository) GetApiCaptureConfig(serviceID string) (*models.ApiCaptureConfig, error) {
	var (
		mode             sql.NullString
		sampleRate       sql.NullInt64
		bodyMaxBytes     sql.NullInt64
		maskedHeaders    sql.NullString
		maskedBodyFields sql.NullString
	)

	err := DB.QueryRow(`
		SELECT api_capture_mode, api_sample_rate, api_body_max_bytes,
		       api_masked_headers, api_masked_body_fields
		FROM services WHERE id = ?
	`, serviceID).Scan(&mode, &sampleRate, &bodyMaxBytes, &maskedHeaders, &maskedBodyFields)
	if err != nil {
		return nil, err
	}

	// Start with defaults; override only where columns are non-NULL.
	cfg := models.DefaultApiCaptureConfig()

	if mode.Valid && mode.String != "" {
		cfg.Mode = models.ApiCaptureMode(mode.String)
	}
	if sampleRate.Valid {
		cfg.SampleRate = int(sampleRate.Int64)
	}
	if bodyMaxBytes.Valid {
		cfg.BodyMaxBytes = int(bodyMaxBytes.Int64)
	}
	// Valid (non-NULL) means the column was explicitly set, even if the value is "".
	// An empty string means the user cleared the list intentionally.
	if maskedHeaders.Valid {
		cfg.MaskedHeaders = splitCommaList(maskedHeaders.String)
	}
	if maskedBodyFields.Valid {
		cfg.MaskedBodyFields = splitCommaList(maskedBodyFields.String)
	}
	// Ensure nil-safe slices for JSON serialization.
	if cfg.MaskedHeaders == nil && maskedHeaders.Valid {
		cfg.MaskedHeaders = []string{}
	}
	if cfg.MaskedBodyFields == nil && maskedBodyFields.Valid {
		cfg.MaskedBodyFields = []string{}
	}

	return &cfg, nil
}

// UpdateApiCaptureConfig persists the given capture configuration for a service.
// MaskedHeaders and MaskedBodyFields are stored as comma-separated TEXT.
func (r *ServiceRepository) UpdateApiCaptureConfig(serviceID string, cfg *models.ApiCaptureConfig) error {
	_, err := DB.Exec(`
		UPDATE services
		SET api_capture_mode       = ?,
		    api_sample_rate        = ?,
		    api_body_max_bytes     = ?,
		    api_masked_headers     = ?,
		    api_masked_body_fields = ?
		WHERE id = ?
	`,
		string(cfg.Mode),
		cfg.SampleRate,
		cfg.BodyMaxBytes,
		joinCommaList(cfg.MaskedHeaders),
		joinCommaList(cfg.MaskedBodyFields),
		serviceID,
	)
	return err
}

// splitCommaList splits a comma-separated string into a slice.
// An empty string returns nil.
func splitCommaList(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		if p != "" {
			result = append(result, p)
		}
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

// joinCommaList joins a slice into a comma-separated string for storage.
// A nil or empty slice returns "" (empty string, not NULL), so that an explicit
// "clear all" can be distinguished from a never-configured NULL column.
func joinCommaList(items []string) string {
	if len(items) == 0 {
		return ""
	}
	return strings.Join(items, ",")
}
