package database

import (
	"database/sql"
	"log"
	"time"

	"github.com/aiturn/everyup/internal/crypto"
	"github.com/aiturn/everyup/internal/models"
)

// NotificationRepository handles notification channel data operations
type NotificationRepository struct{}

// NewNotificationRepository creates a new notification repository
func NewNotificationRepository() *NotificationRepository {
	return &NotificationRepository{}
}

// decryptConfig decrypts a channel's config field, falling back to plaintext on error.
func decryptConfig(encConfig string) string {
	dec, err := crypto.Decrypt(encConfig)
	if err != nil {
		log.Printf("[notification] config decryption failed, using raw value: %v", err)
		return encConfig
	}
	return dec
}

// GetAll returns all notification channels
func (r *NotificationRepository) GetAll() ([]models.NotificationChannel, error) {
	rows, err := DB.Query(`
		SELECT id, name, type, config, is_enabled, created_at
		FROM notification_channels
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var channels []models.NotificationChannel
	for rows.Next() {
		var ch models.NotificationChannel
		var isEnabled int
		var encConfig string
		if err := rows.Scan(&ch.ID, &ch.Name, &ch.Type, &encConfig, &isEnabled, &ch.CreatedAt); err != nil {
			return nil, err
		}
		ch.Config = decryptConfig(encConfig)
		ch.IsEnabled = isEnabled == 1
		channels = append(channels, ch)
	}
	return channels, nil
}

// GetByID returns a notification channel by ID
func (r *NotificationRepository) GetByID(id string) (*models.NotificationChannel, error) {
	var ch models.NotificationChannel
	var isEnabled int
	var encConfig string

	err := DB.QueryRow(`
		SELECT id, name, type, config, is_enabled, created_at
		FROM notification_channels WHERE id = ?
	`, id).Scan(&ch.ID, &ch.Name, &ch.Type, &encConfig, &isEnabled, &ch.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	ch.Config = decryptConfig(encConfig)
	ch.IsEnabled = isEnabled == 1
	return &ch, nil
}

// Create creates a new notification channel
func (r *NotificationRepository) Create(ch *models.NotificationChannel) error {
	isEnabled := 0
	if ch.IsEnabled {
		isEnabled = 1
	}

	encConfig, err := crypto.Encrypt(ch.Config)
	if err != nil {
		return err
	}

	_, err = DB.Exec(`
		INSERT INTO notification_channels (id, name, type, config, is_enabled, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, ch.ID, ch.Name, ch.Type, encConfig, isEnabled, ch.CreatedAt)
	return err
}

// Delete deletes a notification channel
func (r *NotificationRepository) Delete(id string) error {
	_, err := DB.Exec("DELETE FROM notification_channels WHERE id = ?", id)
	return err
}

// Update updates a notification channel
func (r *NotificationRepository) Update(ch *models.NotificationChannel) error {
	isEnabled := 0
	if ch.IsEnabled {
		isEnabled = 1
	}

	encConfig, err := crypto.Encrypt(ch.Config)
	if err != nil {
		return err
	}

	_, err = DB.Exec(`
		UPDATE notification_channels SET name = ?, type = ?, config = ?, is_enabled = ?
		WHERE id = ?
	`, ch.Name, ch.Type, encConfig, isEnabled, ch.ID)
	return err
}

// SetEnabled updates the is_enabled flag of a notification channel
func (r *NotificationRepository) SetEnabled(id string, isEnabled bool) error {
	enabled := 0
	if isEnabled {
		enabled = 1
	}

	_, err := DB.Exec(`UPDATE notification_channels SET is_enabled = ? WHERE id = ?`, enabled, id)
	return err
}

// GetHealth returns aggregated usage/health stats per channel within the last `days`.
// Map key is channel ID. Channels with no history/rules are absent from the map.
func (r *NotificationRepository) GetHealth(days int) (map[string]*models.NotificationChannelHealth, error) {
	cutoff := time.Now().AddDate(0, 0, -days)
	out := make(map[string]*models.NotificationChannelHealth)

	getOrInit := func(id string) *models.NotificationChannelHealth {
		if h, ok := out[id]; ok {
			return h
		}
		h := &models.NotificationChannelHealth{ChannelID: id}
		out[id] = h
		return h
	}

	// last_sent uses a bare-column subquery rather than MAX(sent_at): the
	// modernc driver only maps a result to time.Time when it traces back to a
	// column's declared DATETIME type. An aggregate strips that, returning a
	// string that sql.NullTime cannot scan.
	rows, err := DB.Query(`
		SELECT nh.channel_id,
		       SUM(CASE WHEN status = 'sent'   AND created_at >= ? THEN 1 ELSE 0 END) AS sent_count,
		       SUM(CASE WHEN status = 'failed' AND created_at >= ? THEN 1 ELSE 0 END) AS failed_count,
		       (SELECT s.sent_at FROM notification_history s
		        WHERE s.channel_id = nh.channel_id AND s.sent_at IS NOT NULL
		        ORDER BY s.sent_at DESC LIMIT 1) AS last_sent
		FROM notification_history nh
		GROUP BY nh.channel_id
	`, cutoff, cutoff)
	if err != nil {
		return nil, err
	}
	type histRow struct {
		channelID string
		sent      int
		failed    int
		lastSent  sql.NullTime
	}
	var histRows []histRow
	for rows.Next() {
		var r histRow
		if err := rows.Scan(&r.channelID, &r.sent, &r.failed, &r.lastSent); err != nil {
			rows.Close()
			return nil, err
		}
		histRows = append(histRows, r)
	}
	rows.Close()
	for _, r := range histRows {
		h := getOrInit(r.channelID)
		h.SuccessCount = r.sent
		h.FailedCount = r.failed
		if r.lastSent.Valid {
			t := r.lastSent.Time
			h.LastSentAt = &t
		}
	}

	ruleRows, err := DB.Query(`
		SELECT arc.channel_id, COUNT(DISTINCT arc.rule_id)
		FROM alert_rule_channels arc
		JOIN alert_rules ar ON ar.id = arc.rule_id
		WHERE ar.is_enabled = 1
		GROUP BY arc.channel_id
	`)
	if err != nil {
		return nil, err
	}
	type rcRow struct {
		channelID string
		count     int
	}
	var rcRows []rcRow
	for ruleRows.Next() {
		var r rcRow
		if err := ruleRows.Scan(&r.channelID, &r.count); err != nil {
			ruleRows.Close()
			return nil, err
		}
		rcRows = append(rcRows, r)
	}
	ruleRows.Close()
	for _, r := range rcRows {
		getOrInit(r.channelID).RuleCount = r.count
	}

	return out, nil
}

// GetEnabled returns all enabled notification channels
func (r *NotificationRepository) GetEnabled() ([]models.NotificationChannel, error) {
	rows, err := DB.Query(`
		SELECT id, name, type, config, is_enabled, created_at
		FROM notification_channels
		WHERE is_enabled = 1
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var channels []models.NotificationChannel
	for rows.Next() {
		var ch models.NotificationChannel
		var isEnabled int
		var encConfig string
		if err := rows.Scan(&ch.ID, &ch.Name, &ch.Type, &encConfig, &isEnabled, &ch.CreatedAt); err != nil {
			return nil, err
		}
		ch.Config = decryptConfig(encConfig)
		ch.IsEnabled = isEnabled == 1
		channels = append(channels, ch)
	}
	return channels, nil
}
