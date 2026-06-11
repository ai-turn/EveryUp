package alerter

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/aiturn/everyup/internal/models"
)

// TelegramProvider sends alerts to Telegram via Bot API
type TelegramProvider struct {
	BotToken string
	ChatID   string
}

// NewTelegramProvider creates a new Telegram provider
func NewTelegramProvider(botToken, chatID string) *TelegramProvider {
	return &TelegramProvider{
		BotToken: botToken,
		ChatID:   chatID,
	}
}

// Send sends a notification to Telegram
func (p *TelegramProvider) Send(notification Notification) error {
	var message string

	switch notification.AlertType {
	case AlertTypeLog:
		message = p.buildLogMessage(notification)
	case AlertTypeResource:
		message = p.buildResourceMessage(notification)
	case AlertTypeEndpoint:
		message = p.buildEndpointMessage(notification)
	case AlertTypeSystem:
		message = p.buildSystemMessage(notification)
	default:
		message = p.buildHealthCheckMessage(notification)
	}

	if err := p.sendMessage(message, true); err != nil {
		fallbackErr := p.sendMessage(message, false)
		if fallbackErr == nil {
			return nil
		}
		return fmt.Errorf("%w; plain-text fallback failed: %v", err, fallbackErr)
	}

	return nil
}

func (p *TelegramProvider) sendMessage(message string, markdown bool) error {
	payload := map[string]interface{}{
		"chat_id": p.ChatID,
		"text":    message,
	}
	if markdown {
		payload["parse_mode"] = "Markdown"
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal Telegram payload: %w", err)
	}

	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", p.BotToken)
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return fmt.Errorf("failed to send Telegram message: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		bodyText := strings.TrimSpace(string(body))
		if bodyText == "" {
			return fmt.Errorf("Telegram API returned status %d", resp.StatusCode)
		}
		return fmt.Errorf("Telegram API returned status %d: %s", resp.StatusCode, bodyText)
	}

	return nil
}

// buildHealthCheckMessage creates a health check alert message
func (p *TelegramProvider) buildHealthCheckMessage(n Notification) string {
	statusEmoji := "🚨"
	statusText := "Service Down"
	if n.Status == models.StatusHealthy {
		statusEmoji = "✅"
		statusText = "Service Recovered"
	}

	return fmt.Sprintf(
		"%s *%s*\n\n"+
			"Service: %s\n"+
			"Time: %s\n"+
			"Message: %s",
		statusEmoji,
		statusText,
		n.ServiceName,
		n.Time.Format("2006-01-02 15:04:05"),
		n.Message,
	)
}

// buildLogMessage creates a log alert message
func (p *TelegramProvider) buildLogMessage(n Notification) string {
	levelEmoji := "🔴"
	if strings.EqualFold(n.LogLevel, "warn") {
		levelEmoji = "🟡"
	}

	msg := fmt.Sprintf(
		"%s *Log Alert \\[%s\\]*\n\n"+
			"Service: %s\n"+
			"Level: %s\n"+
			"Time: %s\n"+
			"Message: %s",
		levelEmoji,
		strings.ToUpper(n.LogLevel),
		n.ServiceName,
		strings.ToUpper(n.LogLevel),
		n.Time.Format("2006-01-02 15:04:05"),
		n.Message,
	)

	if len(n.Metadata) > 0 {
		metaParts := make([]string, 0, len(n.Metadata))
		for k, v := range n.Metadata {
			metaParts = append(metaParts, fmt.Sprintf("  %s: %v", k, v))
		}
		msg += "\n\nMetadata:\n" + strings.Join(metaParts, "\n")
	}

	return msg
}

// buildEndpointMessage creates an endpoint health alert message
func (p *TelegramProvider) buildEndpointMessage(n Notification) string {
	severityEmoji := "ℹ️"
	severityText := "Info"
	switch strings.ToLower(n.Severity) {
	case "critical":
		severityEmoji = "🔴"
		severityText = "Critical"
	case "warning":
		severityEmoji = "🟡"
		severityText = "Warning"
	}

	var currentValue, thresholdValue, metricLabel string
	if n.Metric == string(models.AlertMetricResponseTime) {
		currentValue = fmt.Sprintf("%.0fms", n.Value)
		thresholdValue = fmt.Sprintf("%.0fms", n.Threshold)
		metricLabel = "Response Time"
	} else {
		currentValue = fmt.Sprintf("%.0f", n.Value)
		thresholdValue = fmt.Sprintf("%.0f", n.Threshold)
		metricLabel = "HTTP Status"
	}

	return fmt.Sprintf(
		"%s *Endpoint Alert \\[%s\\]*\n\n"+
			"Service: %s\n"+
			"Metric: %s\n"+
			"Current: %s\n"+
			"Threshold: %s\n"+
			"Time: %s\n"+
			"Message: %s",
		severityEmoji,
		severityText,
		n.ServiceName,
		metricLabel,
		currentValue,
		thresholdValue,
		n.Time.Format("2006-01-02 15:04:05"),
		n.Message,
	)
}

// buildSystemMessage creates a system event message (e.g. server boot)
func (p *TelegramProvider) buildSystemMessage(n Notification) string {
	return fmt.Sprintf(
		"🟢 *System Notification*\n\n"+
			"Time: %s\n"+
			"Message: %s",
		n.Time.Format("2006-01-02 15:04:05"),
		n.Message,
	)
}

// buildResourceMessage creates a resource threshold alert message
func (p *TelegramProvider) buildResourceMessage(n Notification) string {
	severityEmoji := "ℹ️"
	severityText := "Info"
	switch strings.ToLower(n.Severity) {
	case "critical":
		severityEmoji = "🔴"
		severityText = "Critical"
	case "warning":
		severityEmoji = "🟡"
		severityText = "Warning"
	}

	metricName := strings.ToUpper(n.Metric)

	return fmt.Sprintf(
		"%s *Resource Alert \\[%s\\]*\n\n"+
			"Host: %s\n"+
			"Metric: %s\n"+
			"Current: %.1f%%\n"+
			"Threshold: %.1f%%\n"+
			"Time: %s\n"+
			"Message: %s",
		severityEmoji,
		severityText,
		n.HostName,
		metricName,
		n.Value,
		n.Threshold,
		n.Time.Format("2006-01-02 15:04:05"),
		n.Message,
	)
}
