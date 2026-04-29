package alerter

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/aiturn/everyup/internal/models"
)

// DiscordProvider sends alerts to Discord via webhook
type DiscordProvider struct {
	WebhookURL string
}

// NewDiscordProvider creates a new Discord provider
func NewDiscordProvider(webhookURL string) *DiscordProvider {
	return &DiscordProvider{
		WebhookURL: webhookURL,
	}
}

// Send sends a notification to Discord
func (p *DiscordProvider) Send(notification Notification) error {
	var embed map[string]interface{}

	switch notification.AlertType {
	case AlertTypeLog:
		embed = p.buildLogEmbed(notification)
	case AlertTypeResource:
		embed = p.buildResourceEmbed(notification)
	case AlertTypeEndpoint:
		embed = p.buildEndpointEmbed(notification)
	case AlertTypeSystem:
		embed = p.buildSystemEmbed(notification)
	default:
		embed = p.buildHealthCheckEmbed(notification)
	}

	payload, err := json.Marshal(embed)
	if err != nil {
		return fmt.Errorf("failed to marshal Discord payload: %w", err)
	}

	resp, err := http.Post(p.WebhookURL, "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return fmt.Errorf("failed to send Discord webhook: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Discord webhook returned status %d", resp.StatusCode)
	}

	return nil
}

// buildHealthCheckEmbed creates a health check Discord embed
func (p *DiscordProvider) buildHealthCheckEmbed(n Notification) map[string]interface{} {
	color := 15158332 // Red for DOWN
	statusEmoji := "🚨"
	if n.Status == models.StatusHealthy {
		color = 3066993 // Green for UP
		statusEmoji = "✅"
	}

	return map[string]interface{}{
		"username": "MT-Monitor",
		"embeds": []map[string]interface{}{
			{
				"title":       fmt.Sprintf("%s Service %s: %s", statusEmoji, n.Status, n.ServiceName),
				"description": n.Message,
				"color":       color,
				"timestamp":   n.Time.Format("2006-01-02T15:04:05Z07:00"),
				"fields": []map[string]interface{}{
					{
						"name":   "Service ID",
						"value":  n.ServiceID,
						"inline": true,
					},
					{
						"name":   "Status",
						"value":  string(n.Status),
						"inline": true,
					},
				},
			},
		},
	}
}

// buildLogEmbed creates a log alert Discord embed
func (p *DiscordProvider) buildLogEmbed(n Notification) map[string]interface{} {
	color := 15158332 // Red — error (default)
	levelEmoji := "🔴"
	switch strings.ToLower(n.LogLevel) {
	case "warn":
		color = 16776960 // Yellow
		levelEmoji = "🟡"
	case "info":
		color = 3447003 // Blue
		levelEmoji = "🔵"
	case "debug":
		color = 10132122 // Slate
		levelEmoji = "⚪"
	case "trace":
		color = 12566463 // Light slate
		levelEmoji = "⚫"
	}

	fields := []map[string]interface{}{
		{
			"name":   "Service",
			"value":  n.ServiceName,
			"inline": true,
		},
		{
			"name":   "Level",
			"value":  strings.ToUpper(n.LogLevel),
			"inline": true,
		},
	}

	// Add metadata as fields
	for k, v := range n.Metadata {
		fields = append(fields, map[string]interface{}{
			"name":   k,
			"value":  fmt.Sprintf("%v", v),
			"inline": true,
		})
	}

	return map[string]interface{}{
		"username": "MT-Monitor",
		"embeds": []map[string]interface{}{
			{
				"title":       fmt.Sprintf("%s Log Alert [%s] — %s", levelEmoji, strings.ToUpper(n.LogLevel), n.ServiceName),
				"description": n.Message,
				"color":       color,
				"timestamp":   n.Time.Format("2006-01-02T15:04:05Z07:00"),
				"fields":      fields,
			},
		},
	}
}

// buildEndpointEmbed creates an endpoint health alert Discord embed
func (p *DiscordProvider) buildEndpointEmbed(n Notification) map[string]interface{} {
	color := 3447003   // Blue for info (recovery)
	severityEmoji := "ℹ️"
	switch strings.ToLower(n.Severity) {
	case "critical":
		color = 15158332 // Red
		severityEmoji = "🔴"
	case "warning":
		color = 16776960 // Yellow
		severityEmoji = "🟡"
	}

	metricLabel := strings.ToUpper(n.Metric)
	currentValue := fmt.Sprintf("%.0f", n.Value)
	thresholdValue := fmt.Sprintf("%.0f", n.Threshold)

	if n.Metric == string(models.AlertMetricResponseTime) {
		currentValue = fmt.Sprintf("%.0fms", n.Value)
		thresholdValue = fmt.Sprintf("%.0fms", n.Threshold)
		metricLabel = "Response Time"
	} else if n.Metric == string(models.AlertMetricHTTPStatus) {
		metricLabel = "HTTP Status"
	}

	return map[string]interface{}{
		"username": "MT-Monitor",
		"embeds": []map[string]interface{}{
			{
				"title":       fmt.Sprintf("%s Endpoint Alert [%s] — %s", severityEmoji, strings.ToUpper(n.Severity), n.ServiceName),
				"description": n.Message,
				"color":       color,
				"timestamp":   n.Time.Format("2006-01-02T15:04:05Z07:00"),
				"fields": []map[string]interface{}{
					{
						"name":   "Service",
						"value":  n.ServiceName,
						"inline": true,
					},
					{
						"name":   "Metric",
						"value":  metricLabel,
						"inline": true,
					},
					{
						"name":   "Current",
						"value":  currentValue,
						"inline": true,
					},
					{
						"name":   "Threshold",
						"value":  thresholdValue,
						"inline": true,
					},
				},
			},
		},
	}
}

// buildSystemEmbed creates a system event Discord embed (e.g. server boot)
func (p *DiscordProvider) buildSystemEmbed(n Notification) map[string]interface{} {
	return map[string]interface{}{
		"username": "MT-Monitor",
		"embeds": []map[string]interface{}{
			{
				"title":       "🟢 System Notification",
				"description": n.Message,
				"color":       3066993, // Green
				"timestamp":   n.Time.Format("2006-01-02T15:04:05Z07:00"),
			},
		},
	}
}

// buildResourceEmbed creates a resource threshold alert Discord embed
func (p *DiscordProvider) buildResourceEmbed(n Notification) map[string]interface{} {
	color := 3447003   // Blue for info
	severityEmoji := "ℹ️"
	switch strings.ToLower(n.Severity) {
	case "critical":
		color = 15158332 // Red
		severityEmoji = "🔴"
	case "warning":
		color = 16776960 // Yellow
		severityEmoji = "🟡"
	}

	return map[string]interface{}{
		"username": "MT-Monitor",
		"embeds": []map[string]interface{}{
			{
				"title":       fmt.Sprintf("%s Resource Alert [%s] — %s", severityEmoji, strings.ToUpper(n.Severity), n.HostName),
				"description": n.Message,
				"color":       color,
				"timestamp":   n.Time.Format("2006-01-02T15:04:05Z07:00"),
				"fields": []map[string]interface{}{
					{
						"name":   "Host",
						"value":  n.HostName,
						"inline": true,
					},
					{
						"name":   "Metric",
						"value":  strings.ToUpper(n.Metric),
						"inline": true,
					},
					{
						"name":   "Current",
						"value":  fmt.Sprintf("%.1f%%", n.Value),
						"inline": true,
					},
					{
						"name":   "Threshold",
						"value":  fmt.Sprintf("%.1f%%", n.Threshold),
						"inline": true,
					},
					{
						"name":   "Severity",
						"value":  strings.ToUpper(n.Severity),
						"inline": true,
					},
				},
			},
		},
	}
}
