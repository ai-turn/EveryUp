package models

import (
	"encoding/json"
	"time"
)

// NotificationChannel represents a configured alert channel
type NotificationChannel struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`   // "telegram" | "discord" | "slack"
	Config    string    `json:"config"` // JSON string
	IsEnabled bool      `json:"isEnabled"`
	CreatedAt time.Time `json:"createdAt"`
}

// NotificationChannelHealth holds aggregated health/usage stats for a channel
type NotificationChannelHealth struct {
	ChannelID    string     `json:"channelId"`
	LastSentAt   *time.Time `json:"lastSentAt,omitempty"`
	SuccessCount int        `json:"successCount"`
	FailedCount  int        `json:"failedCount"`
	RuleCount    int        `json:"ruleCount"`
}

// TelegramConfig holds Telegram bot configuration
type TelegramConfig struct {
	BotToken string `json:"botToken"`
	ChatID   string `json:"chatId"`
}

// DiscordConfig holds Discord webhook configuration
type DiscordConfig struct {
	WebhookURL string `json:"webhookUrl"`
}

// SlackConfig holds Slack incoming webhook configuration
type SlackConfig struct {
	WebhookURL string `json:"webhookUrl"`
}

// NotificationChannelCreateRequest represents the request to create a channel
type NotificationChannelCreateRequest struct {
	Name   string                 `json:"name"`
	Type   string                 `json:"type"`
	Config map[string]interface{} `json:"config"`
}

// MaskConfig returns a copy of the channel with sensitive config fields redacted.
// Use this before returning channels in API responses.
func (ch *NotificationChannel) MaskConfig() NotificationChannel {
	masked := *ch
	switch ch.Type {
	case "telegram":
		var cfg TelegramConfig
		if err := json.Unmarshal([]byte(ch.Config), &cfg); err == nil {
			if cfg.BotToken != "" {
				cfg.BotToken = "***"
			}
			if b, err := json.Marshal(cfg); err == nil {
				masked.Config = string(b)
			}
		}
	case "discord":
		var cfg DiscordConfig
		if err := json.Unmarshal([]byte(ch.Config), &cfg); err == nil {
			if cfg.WebhookURL != "" {
				cfg.WebhookURL = "***"
			}
			if b, err := json.Marshal(cfg); err == nil {
				masked.Config = string(b)
			}
		}
	case "slack":
		var cfg SlackConfig
		if err := json.Unmarshal([]byte(ch.Config), &cfg); err == nil {
			if cfg.WebhookURL != "" {
				cfg.WebhookURL = "***"
			}
			if b, err := json.Marshal(cfg); err == nil {
				masked.Config = string(b)
			}
		}
	}
	return masked
}
