package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/crypto"
)

// migrate runs all database migrations in order.
// Each migrateVN() is idempotent — safe to re-run on existing databases.
// v11 was removed (API metric tables deprecated; existing tables left in place).
func migrate() error {
	migrations := []string{
		// Services table (v2: flattened schema)
		`CREATE TABLE IF NOT EXISTS services (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			type TEXT NOT NULL DEFAULT 'http',
			is_active INTEGER DEFAULT 1,
			url TEXT,
			port INTEGER,
			method TEXT DEFAULT 'GET',
			headers TEXT,
			body TEXT,
			expected_status INTEGER DEFAULT 200,
			interval INTEGER DEFAULT 60,
			timeout INTEGER DEFAULT 5000,
			tags TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Metrics table
		`CREATE TABLE IF NOT EXISTS metrics (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			service_id TEXT NOT NULL,
			status TEXT NOT NULL,
			response_time INTEGER,
			status_code INTEGER,
			error_message TEXT,
			checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
		)`,

		// Index for metrics queries
		`CREATE INDEX IF NOT EXISTS idx_metrics_service_time ON metrics(service_id, checked_at)`,

		// Logs table
		`CREATE TABLE IF NOT EXISTS logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			service_id TEXT,
			level TEXT NOT NULL,
			message TEXT NOT NULL,
			metadata TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Index for logs queries
		`CREATE INDEX IF NOT EXISTS idx_logs_level_time ON logs(level, created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_logs_service ON logs(service_id)`,

		// Incidents table
		`CREATE TABLE IF NOT EXISTS incidents (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			service_id TEXT NOT NULL,
			type TEXT NOT NULL,
			message TEXT,
			started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			resolved_at DATETIME,
			FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
		)`,

		// Index for incidents queries
		`CREATE INDEX IF NOT EXISTS idx_incidents_service ON incidents(service_id)`,
		`CREATE INDEX IF NOT EXISTS idx_incidents_active ON incidents(resolved_at) WHERE resolved_at IS NULL`,

		// Notification channels table
		`CREATE TABLE IF NOT EXISTS notification_channels (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			type TEXT NOT NULL,
			config TEXT NOT NULL,
			is_enabled INTEGER DEFAULT 1,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Hosts table
		`CREATE TABLE IF NOT EXISTS hosts (
			id            TEXT PRIMARY KEY,
			name          TEXT NOT NULL,
			type          TEXT NOT NULL DEFAULT 'local',
			ip            TEXT NOT NULL DEFAULT '',
			port          INTEGER DEFAULT 0,
			"group"       TEXT NOT NULL DEFAULT '',
			is_active     INTEGER DEFAULT 1,
			description   TEXT DEFAULT '',
			ssh_user      TEXT DEFAULT '',
			ssh_port      INTEGER DEFAULT 22,
			ssh_auth_type TEXT DEFAULT '',
			ssh_key_path  TEXT DEFAULT '',
			ssh_key       TEXT DEFAULT '',
			ssh_password  TEXT DEFAULT '',
			last_error    TEXT DEFAULT '',
			created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// System metrics table (1-minute aggregates)
		`CREATE TABLE IF NOT EXISTS system_metrics (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			host_id     TEXT NOT NULL DEFAULT 'local',
			cpu_usage   REAL NOT NULL,
			mem_total   REAL NOT NULL,
			mem_used    REAL NOT NULL,
			mem_usage   REAL NOT NULL,
			disk_total  REAL NOT NULL,
			disk_used   REAL NOT NULL,
			disk_usage  REAL NOT NULL,
			disk_read   REAL DEFAULT 0,
			disk_write  REAL DEFAULT 0,
			net_in      REAL DEFAULT 0,
			net_out     REAL DEFAULT 0,
			created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Index for system metrics time-series queries
		`CREATE INDEX IF NOT EXISTS idx_system_metrics_time ON system_metrics(created_at)`,
		// NOTE: idx_system_metrics_host_time is created in migrateV3() for backward compat
	}

	for _, migration := range migrations {
		if _, err := DB.Exec(migration); err != nil {
			return fmt.Errorf("migration failed: %w\nSQL: %s", err, migration)
		}
	}

	if err := migrateV2(); err != nil {
		return fmt.Errorf("v2 migration failed: %w", err)
	}
	if err := migrateV3(); err != nil {
		return fmt.Errorf("v3 migration failed: %w", err)
	}
	if err := migrateV4(); err != nil {
		return fmt.Errorf("v4 migration failed: %w", err)
	}
	if err := migrateV5(); err != nil {
		return fmt.Errorf("v5 migration failed: %w", err)
	}
	if err := migrateV6(); err != nil {
		return fmt.Errorf("v6 migration failed: %w", err)
	}
	if err := migrateV7(); err != nil {
		return fmt.Errorf("v7 migration failed: %w", err)
	}
	if err := migrateV8(); err != nil {
		return fmt.Errorf("v8 migration failed: %w", err)
	}
	if err := migrateV9(); err != nil {
		return fmt.Errorf("v9 migration failed: %w", err)
	}
	if err := migrateV10(); err != nil {
		return fmt.Errorf("v10 migration failed: %w", err)
	}
	// v11 removed — API metric tables deprecated
	if err := migrateV12(); err != nil {
		return fmt.Errorf("v12 migration failed: %w", err)
	}
	if err := migrateV13(); err != nil {
		return fmt.Errorf("v13 migration failed: %w", err)
	}
	if err := migrateV14(); err != nil {
		return fmt.Errorf("v14 migration failed: %w", err)
	}
	if err := migrateV15(); err != nil {
		return fmt.Errorf("v15 migration failed: %w", err)
	}
	if err := migrateV16(); err != nil {
		return fmt.Errorf("v16 migration failed: %w", err)
	}
	if err := migrateV17(); err != nil {
		return fmt.Errorf("v17 migration failed: %w", err)
	}
	if err := migrateV18(); err != nil {
		return fmt.Errorf("v18 migration failed: %w", err)
	}
	if err := migrateV19(); err != nil {
		return fmt.Errorf("v19 migration failed: %w", err)
	}
	if err := migrateV20(); err != nil {
		return fmt.Errorf("v20 migration failed: %w", err)
	}

	return nil
}

// migrateV2 migrates existing services table from config JSON to flattened columns.
// Added: 2024 — flattened HTTP/TCP config into individual columns.
func migrateV2() error {
	// Check if migration is needed by checking if 'config' column exists
	var hasConfigColumn bool
	rows, err := DB.Query("PRAGMA table_info(services)")
	if err != nil {
		return err
	}
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dfltValue sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dfltValue, &pk); err != nil {
			rows.Close()
			return err
		}
		if name == "config" {
			hasConfigColumn = true
			break
		}
	}
	rows.Close() // Must close before next query (SetMaxOpenConns=1)

	if !hasConfigColumn {
		return nil
	}

	// Check if is_active column already exists (partial migration)
	rows2, err := DB.Query("PRAGMA table_info(services)")
	if err != nil {
		return err
	}
	var hasIsActiveColumn bool
	for rows2.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dfltValue sql.NullString
		if err := rows2.Scan(&cid, &name, &ctype, &notnull, &dfltValue, &pk); err != nil {
			rows2.Close()
			return err
		}
		if name == "is_active" {
			hasIsActiveColumn = true
			break
		}
	}
	rows2.Close()

	if hasIsActiveColumn {
		return nil
	}

	alterStatements := []string{
		"ALTER TABLE services ADD COLUMN is_active INTEGER DEFAULT 1",
		"ALTER TABLE services ADD COLUMN url TEXT",
		"ALTER TABLE services ADD COLUMN port INTEGER",
		"ALTER TABLE services ADD COLUMN method TEXT DEFAULT 'GET'",
		"ALTER TABLE services ADD COLUMN headers TEXT",
		"ALTER TABLE services ADD COLUMN body TEXT",
		"ALTER TABLE services ADD COLUMN expected_status INTEGER DEFAULT 200",
		"ALTER TABLE services ADD COLUMN interval INTEGER DEFAULT 60",
		"ALTER TABLE services ADD COLUMN timeout INTEGER DEFAULT 5000",
		"ALTER TABLE services ADD COLUMN tags TEXT",
	}

	for _, stmt := range alterStatements {
		if _, err := DB.Exec(stmt); err != nil {
			if !isDuplicateColumnError(err) {
				return fmt.Errorf("migration failed: %w\nSQL: %s", err, stmt)
			}
		}
	}

	return migrateConfigData()
}

// migrateV3 adds host_id column to system_metrics for existing databases.
// Added: 2024-02 — multi-host system metrics support.
func migrateV3() error {
	rows, err := DB.Query("PRAGMA table_info(system_metrics)")
	if err != nil {
		return err
	}
	defer rows.Close()

	var hasHostID bool
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dfltValue sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dfltValue, &pk); err != nil {
			return err
		}
		if name == "host_id" {
			hasHostID = true
			break
		}
	}

	if hasHostID {
		return nil
	}

	if _, err := DB.Exec(`ALTER TABLE system_metrics ADD COLUMN host_id TEXT NOT NULL DEFAULT 'local'`); err != nil {
		return fmt.Errorf("failed to add host_id column: %w", err)
	}
	if _, err := DB.Exec(`CREATE INDEX IF NOT EXISTS idx_system_metrics_host_time ON system_metrics(host_id, created_at)`); err != nil {
		return fmt.Errorf("failed to create host_id index: %w", err)
	}
	return nil
}

// migrateV4 adds SSH fields and last_error to hosts table.
// Added: 2024-02 — SSH remote monitoring support.
func migrateV4() error {
	alterStatements := []string{
		"ALTER TABLE hosts ADD COLUMN ssh_user TEXT DEFAULT ''",
		"ALTER TABLE hosts ADD COLUMN ssh_port INTEGER DEFAULT 22",
		"ALTER TABLE hosts ADD COLUMN ssh_auth_type TEXT DEFAULT ''",
		"ALTER TABLE hosts ADD COLUMN ssh_key_path TEXT DEFAULT ''",
		"ALTER TABLE hosts ADD COLUMN ssh_key TEXT DEFAULT ''",
		"ALTER TABLE hosts ADD COLUMN ssh_password TEXT DEFAULT ''",
		"ALTER TABLE hosts ADD COLUMN last_error TEXT DEFAULT ''",
	}

	for _, stmt := range alterStatements {
		if _, err := DB.Exec(stmt); err != nil {
			if err.Error() != fmt.Sprintf("duplicate column name: %s", extractColumnName(stmt)) {
				continue
			}
		}
	}
	return nil
}

// migrateV5 adds api_key to services and source/fingerprint to logs.
// Added: 2024-02 — external log ingestion via API key.
func migrateV5() error {
	alterStatements := []string{
		"ALTER TABLE services ADD COLUMN api_key TEXT DEFAULT ''",
		"ALTER TABLE logs ADD COLUMN source TEXT DEFAULT 'internal'",
		"ALTER TABLE logs ADD COLUMN fingerprint TEXT DEFAULT ''",
	}
	for _, stmt := range alterStatements {
		DB.Exec(stmt) // ignore duplicate column errors
	}
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_logs_fingerprint_time ON logs(fingerprint, created_at)")
	return nil
}

// migrateV6 creates the alert rules system tables and seeds default presets.
// Added: 2024-02 — alert rules + notification channels.
func migrateV6() error {
	_, err := DB.Exec(`CREATE TABLE IF NOT EXISTS alert_rules (
		id          TEXT PRIMARY KEY,
		name        TEXT NOT NULL,
		type        TEXT NOT NULL,
		host_id     TEXT,
		service_id  TEXT,
		metric      TEXT NOT NULL,
		operator    TEXT NOT NULL DEFAULT 'gt',
		threshold   REAL NOT NULL DEFAULT 0,
		duration    INTEGER NOT NULL DEFAULT 1,
		severity    TEXT NOT NULL DEFAULT 'warning',
		is_enabled  INTEGER DEFAULT 1,
		cooldown    INTEGER DEFAULT 300,
		created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
	if err != nil {
		return fmt.Errorf("failed to create alert_rules table: %w", err)
	}

	_, err = DB.Exec(`CREATE TABLE IF NOT EXISTS alert_rule_channels (
		rule_id    TEXT NOT NULL,
		channel_id TEXT NOT NULL,
		PRIMARY KEY (rule_id, channel_id),
		FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE,
		FOREIGN KEY (channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE
	)`)
	if err != nil {
		return fmt.Errorf("failed to create alert_rule_channels table: %w", err)
	}

	DB.Exec("CREATE INDEX IF NOT EXISTS idx_alert_rules_host ON alert_rules(host_id, is_enabled)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_alert_rules_service ON alert_rules(service_id, is_enabled)")

	seedDefaultAlertRules()
	return nil
}

// migrateV7 adds notification_history and alert_rule_state tables.
// Added: 2024-02 — notification delivery tracking and alert state persistence.
func migrateV7() error {
	_, err := DB.Exec(`CREATE TABLE IF NOT EXISTS notification_history (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		rule_id TEXT,
		channel_id TEXT NOT NULL,
		channel_name TEXT NOT NULL,
		channel_type TEXT NOT NULL,
		alert_type TEXT NOT NULL,
		severity TEXT,
		host_id TEXT,
		host_name TEXT,
		service_id TEXT,
		service_name TEXT,
		message TEXT NOT NULL,
		status TEXT DEFAULT 'pending',
		error_message TEXT,
		retry_count INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		sent_at DATETIME,
		FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE SET NULL,
		FOREIGN KEY (channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE
	)`)
	if err != nil {
		return fmt.Errorf("failed to create notification_history table: %w", err)
	}

	DB.Exec("CREATE INDEX IF NOT EXISTS idx_notification_history_channel ON notification_history(channel_id, created_at)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_notification_history_type ON notification_history(alert_type, created_at)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_notification_history_status ON notification_history(status)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_notification_history_created ON notification_history(created_at)")

	_, err = DB.Exec(`CREATE TABLE IF NOT EXISTS alert_rule_state (
		rule_id TEXT NOT NULL,
		host_id TEXT NOT NULL,
		breach_count INTEGER DEFAULT 0,
		last_alerted_at DATETIME,
		is_alerting INTEGER DEFAULT 0,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (rule_id, host_id),
		FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
	)`)
	if err != nil {
		return fmt.Errorf("failed to create alert_rule_state table: %w", err)
	}

	DB.Exec("CREATE INDEX IF NOT EXISTS idx_alert_rule_state_rule ON alert_rule_state(rule_id)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_alert_rule_state_host ON alert_rule_state(host_id)")
	return nil
}

// migrateV8 adds schedule_type and cron_expression columns to services.
// Added: 2024-02 — cron-based scheduled health checks.
func migrateV8() error {
	var hasScheduleType bool
	rows, err := DB.Query("PRAGMA table_info(services)")
	if err != nil {
		return err
	}
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dfltValue sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dfltValue, &pk); err != nil {
			rows.Close()
			return err
		}
		if name == "schedule_type" {
			hasScheduleType = true
			break
		}
	}
	rows.Close()

	if !hasScheduleType {
		if _, err := DB.Exec(`ALTER TABLE services ADD COLUMN schedule_type TEXT DEFAULT 'interval'`); err != nil {
			return fmt.Errorf("failed to add schedule_type column: %w", err)
		}
	}

	var hasCronExpression bool
	rows2, err := DB.Query("PRAGMA table_info(services)")
	if err != nil {
		return err
	}
	for rows2.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dfltValue sql.NullString
		if err := rows2.Scan(&cid, &name, &ctype, &notnull, &dfltValue, &pk); err != nil {
			rows2.Close()
			return err
		}
		if name == "cron_expression" {
			hasCronExpression = true
			break
		}
	}
	rows2.Close()

	if !hasCronExpression {
		if _, err := DB.Exec(`ALTER TABLE services ADD COLUMN cron_expression TEXT`); err != nil {
			return fmt.Errorf("failed to add cron_expression column: %w", err)
		}
	}
	return nil
}

// migrateV9 removes deprecated warning-level preset rules.
// Added: 2024-02 — simplified preset set (critical only).
func migrateV9() error {
	DB.Exec(`DELETE FROM alert_rules WHERE id IN ('preset-cpu-warning', 'preset-mem-warning')`)
	return nil
}

// migrateV10 adds resource_category column to hosts table.
// Added: 2024-02 — infrastructure categorization (server/network/etc).
func migrateV10() error {
	rows, err := DB.Query("PRAGMA table_info(hosts)")
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name, colType string
		var notNull int
		var dfltValue sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &colType, &notNull, &dfltValue, &pk); err != nil {
			return err
		}
		if name == "resource_category" {
			return nil // already migrated
		}
	}

	_, err = DB.Exec(`ALTER TABLE hosts ADD COLUMN resource_category TEXT NOT NULL DEFAULT 'server'`)
	return err
}

// migrateV11 removed — API metric tables (api_endpoints, api_endpoint_stats, api_errors) deprecated.
// Existing tables are left in place for backward compatibility but no longer created for new DBs.

// migrateV12 adds custom message column to alert_rules.
// Added: 2024-02 — per-rule notification message override.
func migrateV12() error {
	DB.Exec("ALTER TABLE alert_rules ADD COLUMN message TEXT DEFAULT ''")
	return nil
}

// migrateV13 hashes any plaintext API keys in the services table.
// Keys generated by GenerateApiKey() start with "mt_". All such keys are
// replaced with their SHA-256 hex digest so the DB never stores raw keys.
// Added: 2024-02 — security hardening, hashed API key storage.
func migrateV13() error {
	rows, err := DB.Query(`SELECT id, api_key FROM services WHERE api_key != ''`)
	if err != nil {
		return err
	}

	type pair struct{ id, key string }
	var pairs []pair
	for rows.Next() {
		var p pair
		if err := rows.Scan(&p.id, &p.key); err != nil {
			rows.Close()
			return err
		}
		pairs = append(pairs, p)
	}
	rows.Close()

	hashed := 0
	for _, p := range pairs {
		if strings.HasPrefix(p.key, "mt_") {
			if _, err := DB.Exec(`UPDATE services SET api_key = ? WHERE id = ?`,
				crypto.HashApiKey(p.key), p.id); err != nil {
				return err
			}
			hashed++
		}
	}
	if hashed > 0 {
		log.Printf("[migrateV13] Hashed %d plaintext API key(s) in services table", hashed)
	}
	return nil
}

// migrateV14 adds is_system column to alert_rules and seeds the system boot notification rule.
// Added: 2024-02 — system-managed rules that users cannot delete.
func migrateV14() error {
	DB.Exec("ALTER TABLE alert_rules ADD COLUMN is_system INTEGER DEFAULT 0")

	var exists int
	if err := DB.QueryRow(`SELECT COUNT(*) FROM alert_rules WHERE id = 'system-boot'`).Scan(&exists); err != nil {
		return err
	}
	if exists == 0 {
		now := time.Now()
		_, err := DB.Exec(`
			INSERT INTO alert_rules (id, name, type, metric, operator, threshold, duration,
			                         severity, is_enabled, cooldown, message, is_system, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, "system-boot", "Server Boot Notification", "system", "status_change", "gt", 0, 0,
			"info", 1, 0, "Server has been started", 1, now, now)
		if err != nil {
			return fmt.Errorf("failed to seed system boot rule: %w", err)
		}
		log.Printf("[migrateV14] Created system boot notification rule")
	}
	return nil
}

// migrateV15 adds api_key_masked column to services.
// Added: 2024-02 — display masked key in UI without exposing the hash.
func migrateV15() error {
	DB.Exec("ALTER TABLE services ADD COLUMN api_key_masked TEXT DEFAULT ''")
	return nil
}

// migrateV16 creates the app_settings table for internal key-value settings.
// Added: 2024-03 — auto-managed AES encryption key storage.
func migrateV16() error {
	_, err := DB.Exec(`CREATE TABLE IF NOT EXISTS app_settings (
		key   TEXT PRIMARY KEY,
		value TEXT NOT NULL
	)`)
	return err
}

// migrateV17 documents that jwt_secret is stored in app_settings under key "jwt_secret".
// No schema change required — app_settings table exists since migrateV16.
// The key is auto-inserted by crypto.InitJWTSecret() on first run.
// Added: 2024-03 — JWT secret persistence across restarts.
func migrateV17() error {
	return nil
}

// migrateV18 creates the users table for local password-based authentication.
// Added: 2024-03 — replaced GitHub OAuth with local auth.
func migrateV18() error {
	_, err := DB.Exec(`CREATE TABLE IF NOT EXISTS users (
		id            INTEGER PRIMARY KEY AUTOINCREMENT,
		username      TEXT    NOT NULL UNIQUE,
		password_hash TEXT    NOT NULL,
		role          TEXT    NOT NULL DEFAULT 'admin',
		created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`)
	return err
}

// migrateV19 adds log_level_filter column to services table.
// NULL means accept all levels (default). Non-null is a JSON array like ["error","warn"].
// Added: 2024-03 — per-service log level filtering.
func migrateV19() error {
	_, err := DB.Exec(`ALTER TABLE services ADD COLUMN log_level_filter TEXT DEFAULT NULL`)
	if err != nil && !strings.Contains(err.Error(), "duplicate column") {
		return err
	}
	return nil
}

// migrateV20 creates the api_requests table for per-service HTTP traffic capture
// and adds five capture-config columns to the services table.
// Added: 2026-04-17
func migrateV20() error {
	return Transaction(func(tx *sql.Tx) error {
		stmts := []string{
			`CREATE TABLE IF NOT EXISTS api_requests (
				id             INTEGER PRIMARY KEY AUTOINCREMENT,
				service_id     TEXT    NOT NULL,
				request_id     TEXT    NOT NULL,
				method         TEXT    NOT NULL,
				path           TEXT    NOT NULL,
				path_template  TEXT    NOT NULL,
				status_code    INTEGER NOT NULL,
				duration_ms    INTEGER NOT NULL,
				client_ip      TEXT,
				req_headers    TEXT,
				req_body       TEXT,
				req_body_size  INTEGER NOT NULL DEFAULT 0,
				res_headers    TEXT,
				res_body       TEXT,
				res_body_size  INTEGER NOT NULL DEFAULT 0,
				error          TEXT,
				is_error       INTEGER NOT NULL DEFAULT 0,
				created_at     DATETIME NOT NULL,
				FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
			)`,
			`CREATE INDEX IF NOT EXISTS idx_api_requests_service_time   ON api_requests(service_id, created_at DESC)`,
			`CREATE INDEX IF NOT EXISTS idx_api_requests_service_status ON api_requests(service_id, status_code)`,
			`CREATE INDEX IF NOT EXISTS idx_api_requests_service_error  ON api_requests(service_id, is_error, created_at DESC)`,
			`CREATE INDEX IF NOT EXISTS idx_api_requests_request_id     ON api_requests(request_id)`,
		}
		for _, s := range stmts {
			if _, err := tx.Exec(s); err != nil {
				return err
			}
		}

		alterCols := []string{
			`ALTER TABLE services ADD COLUMN api_capture_mode       TEXT`,
			`ALTER TABLE services ADD COLUMN api_sample_rate        INTEGER`,
			`ALTER TABLE services ADD COLUMN api_body_max_bytes     INTEGER`,
			`ALTER TABLE services ADD COLUMN api_masked_headers     TEXT`,
			`ALTER TABLE services ADD COLUMN api_masked_body_fields TEXT`,
		}
		for _, s := range alterCols {
			if _, err := tx.Exec(s); err != nil && !strings.Contains(err.Error(), "duplicate column") {
				return err
			}
		}
		return nil
	})
}

// --- helpers ---

// isDuplicateColumnError checks if the error is a duplicate column error (migrateV2)
func isDuplicateColumnError(err error) bool {
	return err != nil && (
		err.Error() == "duplicate column name: is_active" ||
			err.Error() == "duplicate column name: url" ||
			err.Error() == "duplicate column name: port" ||
			err.Error() == "duplicate column name: method" ||
			err.Error() == "duplicate column name: headers" ||
			err.Error() == "duplicate column name: body" ||
			err.Error() == "duplicate column name: expected_status" ||
			err.Error() == "duplicate column name: interval" ||
			err.Error() == "duplicate column name: timeout" ||
			err.Error() == "duplicate column name: tags")
}

// extractColumnName extracts the column name from an ALTER TABLE ADD COLUMN statement
func extractColumnName(stmt string) string {
	const prefix = "COLUMN "
	idx := len(prefix)
	start := 0
	for i := 0; i < len(stmt)-idx; i++ {
		if stmt[i:i+idx] == prefix {
			start = i + idx
			break
		}
	}
	if start == 0 {
		return ""
	}
	end := start
	for end < len(stmt) && stmt[end] != ' ' {
		end++
	}
	return stmt[start:end]
}

// migrateConfigData migrates existing config JSON data to flattened columns (migrateV2)
func migrateConfigData() error {
	rows, err := DB.Query("SELECT id, type, config FROM services WHERE config IS NOT NULL AND config != ''")
	if err != nil {
		return err
	}
	defer rows.Close()

	type httpConfig struct {
		URL            string            `json:"url"`
		Method         string            `json:"method"`
		Headers        map[string]string `json:"headers"`
		ExpectedStatus int               `json:"expectedStatus"`
		Timeout        int               `json:"timeout"`
		Interval       int               `json:"interval"`
	}

	type tcpConfig struct {
		Host     string `json:"host"`
		Port     int    `json:"port"`
		Timeout  int    `json:"timeout"`
		Interval int    `json:"interval"`
	}

	for rows.Next() {
		var id, svcType, configJSON string
		if err := rows.Scan(&id, &svcType, &configJSON); err != nil {
			continue
		}

		var url, method, headers string
		var port, expectedStatus, interval, timeout int

		if svcType == "http" {
			var cfg httpConfig
			if err := json.Unmarshal([]byte(configJSON), &cfg); err != nil {
				continue
			}
			url = cfg.URL
			method = cfg.Method
			if method == "" {
				method = "GET"
			}
			expectedStatus = cfg.ExpectedStatus
			if expectedStatus == 0 {
				expectedStatus = 200
			}
			timeout = cfg.Timeout
			if timeout == 0 {
				timeout = 5000
			}
			interval = cfg.Interval
			if interval == 0 {
				interval = 60
			}
			if cfg.Headers != nil {
				headersBytes, _ := json.Marshal(cfg.Headers)
				headers = string(headersBytes)
			}
		} else if svcType == "tcp" {
			var cfg tcpConfig
			if err := json.Unmarshal([]byte(configJSON), &cfg); err != nil {
				continue
			}
			url = cfg.Host
			port = cfg.Port
			timeout = cfg.Timeout
			if timeout == 0 {
				timeout = 3000
			}
			interval = cfg.Interval
			if interval == 0 {
				interval = 60
			}
		}

		_, err := DB.Exec(`
			UPDATE services
			SET url = ?, port = ?, method = ?, headers = ?, expected_status = ?, interval = ?, timeout = ?
			WHERE id = ?
		`, url, port, method, headers, expectedStatus, interval, timeout, id)
		if err != nil {
			return err
		}
	}

	return nil
}

// seedDefaultAlertRules seeds the default preset alert rules (disabled by default).
// Idempotent — skips if any preset rules already exist.
func seedDefaultAlertRules() {
	var count int
	DB.QueryRow("SELECT COUNT(*) FROM alert_rules WHERE id LIKE 'preset-%'").Scan(&count)
	if count > 0 {
		return
	}

	presets := []struct {
		id, name, metric, severity string
		threshold                  float64
		duration                   int
	}{
		{"preset-cpu-critical", "High CPU Usage", "cpu", "critical", 90, 3},
		{"preset-mem-critical", "High Memory Usage", "memory", "critical", 85, 3},
		{"preset-disk-critical", "Disk Almost Full", "disk", "critical", 90, 1},
	}

	now := time.Now()
	for _, p := range presets {
		DB.Exec(`INSERT OR IGNORE INTO alert_rules
			(id, name, type, metric, operator, threshold, duration, severity, is_enabled, cooldown, created_at, updated_at)
			VALUES (?, ?, 'resource', ?, 'gt', ?, ?, ?, 0, 300, ?, ?)`,
			p.id, p.name, p.metric, p.threshold, p.duration, p.severity, now, now)
	}
}
