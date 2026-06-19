package alerter

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/aiturn/everyup/internal/models"
)

// SlackProvider sends alerts to Slack via incoming webhook
type SlackProvider struct {
	WebhookURL string
}

// NewSlackProvider creates a new Slack provider
func NewSlackProvider(webhookURL string) *SlackProvider {
	return &SlackProvider{
		WebhookURL: webhookURL,
	}
}

// Send sends a notification to Slack
func (p *SlackProvider) Send(notification Notification) error {
	var payload map[string]interface{}

	switch notification.AlertType {
	case AlertTypeLog:
		payload = p.buildLogPayload(notification)
	case AlertTypeResource:
		payload = p.buildResourcePayload(notification)
	case AlertTypeEndpoint:
		payload = p.buildEndpointPayload(notification)
	case AlertTypeSystem:
		payload = p.buildSystemPayload(notification)
	default:
		payload = p.buildHealthCheckPayload(notification)
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal Slack payload: %w", err)
	}

	resp, err := http.Post(p.WebhookURL, "application/json", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return fmt.Errorf("failed to send Slack webhook: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Slack webhook returned status %d", resp.StatusCode)
	}

	return nil
}

// buildHealthCheckPayload creates a health check Slack Block Kit payload
func (p *SlackProvider) buildHealthCheckPayload(n Notification) map[string]interface{} {
	color := "#ef4444" // Red for DOWN
	statusEmoji := ":rotating_light:"
	if n.Status == models.StatusHealthy {
		color = "#10b981" // Green for UP
		statusEmoji = ":white_check_mark:"
	}

	return map[string]interface{}{
		"username": ProductName,
		"attachments": []map[string]interface{}{
			{
				"color": color,
				"blocks": []map[string]interface{}{
					{
						"type": "section",
						"text": map[string]interface{}{
							"type": "mrkdwn",
							"text": fmt.Sprintf("%s *Service %s: %s*", statusEmoji, n.Status, n.ServiceName),
						},
					},
					{
						"type": "section",
						"text": map[string]interface{}{
							"type": "mrkdwn",
							"text": n.Message,
						},
					},
					{
						"type": "section",
						"fields": []map[string]interface{}{
							{
								"type": "mrkdwn",
								"text": fmt.Sprintf("*Service ID*\n%s", n.ServiceID),
							},
							{
								"type": "mrkdwn",
								"text": fmt.Sprintf("*Status*\n%s", n.Status),
							},
						},
					},
					{
						"type": "context",
						"elements": []map[string]interface{}{
							{
								"type": "mrkdwn",
								"text": fmt.Sprintf("%s • %s", ProductName, n.Time.Format("2006-01-02 15:04:05")),
							},
						},
					},
				},
			},
		},
	}
}

// buildLogPayload creates a log alert Slack payload
func (p *SlackProvider) buildLogPayload(n Notification) map[string]interface{} {
	color := "#ef4444" // Red — error (default)
	levelEmoji := ":red_circle:"
	switch strings.ToLower(n.LogLevel) {
	case "warn":
		color = "#f59e0b"
		levelEmoji = ":large_yellow_circle:"
	case "info":
		color = "#3b82f6"
		levelEmoji = ":large_blue_circle:"
	case "debug":
		color = "#9aa0a6"
		levelEmoji = ":white_circle:"
	case "trace":
		color = "#bfc1c4"
		levelEmoji = ":black_circle:"
	}

	fields := []map[string]interface{}{
		{
			"type": "mrkdwn",
			"text": fmt.Sprintf("*Service*\n%s", n.ServiceName),
		},
		{
			"type": "mrkdwn",
			"text": fmt.Sprintf("*Level*\n%s", strings.ToUpper(n.LogLevel)),
		},
	}

	for k, v := range n.Metadata {
		fields = append(fields, map[string]interface{}{
			"type": "mrkdwn",
			"text": fmt.Sprintf("*%s*\n%v", k, v),
		})
	}

	return map[string]interface{}{
		"username": ProductName,
		"attachments": []map[string]interface{}{
			{
				"color": color,
				"blocks": []map[string]interface{}{
					{
						"type": "section",
						"text": map[string]interface{}{
							"type": "mrkdwn",
							"text": fmt.Sprintf("%s *Log Alert [%s] — %s*", levelEmoji, strings.ToUpper(n.LogLevel), n.ServiceName),
						},
					},
					{
						"type": "section",
						"text": map[string]interface{}{
							"type": "mrkdwn",
							"text": n.Message,
						},
					},
					{
						"type":   "section",
						"fields": fields,
					},
					{
						"type": "context",
						"elements": []map[string]interface{}{
							{
								"type": "mrkdwn",
								"text": fmt.Sprintf("%s • %s", ProductName, n.Time.Format("2006-01-02 15:04:05")),
							},
						},
					},
				},
			},
		},
	}
}

// buildEndpointPayload creates an endpoint health alert Slack payload
func (p *SlackProvider) buildEndpointPayload(n Notification) map[string]interface{} {
	color := "#3b82f6" // Blue for info
	severityEmoji := ":information_source:"
	switch strings.ToLower(n.Severity) {
	case "critical":
		color = "#ef4444"
		severityEmoji = ":red_circle:"
	case "warning":
		color = "#f59e0b"
		severityEmoji = ":large_yellow_circle:"
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
		"username": ProductName,
		"attachments": []map[string]interface{}{
			{
				"color": color,
				"blocks": []map[string]interface{}{
					{
						"type": "section",
						"text": map[string]interface{}{
							"type": "mrkdwn",
							"text": fmt.Sprintf("%s *Endpoint Alert [%s] — %s*", severityEmoji, strings.ToUpper(n.Severity), n.ServiceName),
						},
					},
					{
						"type": "section",
						"text": map[string]interface{}{
							"type": "mrkdwn",
							"text": n.Message,
						},
					},
					{
						"type": "section",
						"fields": []map[string]interface{}{
							{
								"type": "mrkdwn",
								"text": fmt.Sprintf("*Service*\n%s", n.ServiceName),
							},
							{
								"type": "mrkdwn",
								"text": fmt.Sprintf("*Metric*\n%s", metricLabel),
							},
							{
								"type": "mrkdwn",
								"text": fmt.Sprintf("*Current*\n%s", currentValue),
							},
							{
								"type": "mrkdwn",
								"text": fmt.Sprintf("*Threshold*\n%s", thresholdValue),
							},
						},
					},
					{
						"type": "context",
						"elements": []map[string]interface{}{
							{
								"type": "mrkdwn",
								"text": fmt.Sprintf("%s • %s", ProductName, n.Time.Format("2006-01-02 15:04:05")),
							},
						},
					},
				},
			},
		},
	}
}

// buildSystemPayload creates a system event Slack payload
func (p *SlackProvider) buildSystemPayload(n Notification) map[string]interface{} {
	return map[string]interface{}{
		"username": ProductName,
		"attachments": []map[string]interface{}{
			{
				"color": "#10b981",
				"blocks": []map[string]interface{}{
					{
						"type": "section",
						"text": map[string]interface{}{
							"type": "mrkdwn",
							"text": ":large_green_circle: *System Notification*",
						},
					},
					{
						"type": "section",
						"text": map[string]interface{}{
							"type": "mrkdwn",
							"text": n.Message,
						},
					},
					{
						"type": "context",
						"elements": []map[string]interface{}{
							{
								"type": "mrkdwn",
								"text": fmt.Sprintf("%s • %s", ProductName, n.Time.Format("2006-01-02 15:04:05")),
							},
						},
					},
				},
			},
		},
	}
}

// buildResourcePayload creates a resource threshold alert Slack payload
func (p *SlackProvider) buildResourcePayload(n Notification) map[string]interface{} {
	color := "#3b82f6"
	severityEmoji := ":information_source:"
	switch strings.ToLower(n.Severity) {
	case "critical":
		color = "#ef4444"
		severityEmoji = ":red_circle:"
	case "warning":
		color = "#f59e0b"
		severityEmoji = ":large_yellow_circle:"
	}

	return map[string]interface{}{
		"username": ProductName,
		"attachments": []map[string]interface{}{
			{
				"color": color,
				"blocks": []map[string]interface{}{
					{
						"type": "section",
						"text": map[string]interface{}{
							"type": "mrkdwn",
							"text": fmt.Sprintf("%s *Resource Alert [%s] — %s*", severityEmoji, strings.ToUpper(n.Severity), n.HostName),
						},
					},
					{
						"type": "section",
						"text": map[string]interface{}{
							"type": "mrkdwn",
							"text": n.Message,
						},
					},
					{
						"type": "section",
						"fields": []map[string]interface{}{
							{
								"type": "mrkdwn",
								"text": fmt.Sprintf("*Host*\n%s", n.HostName),
							},
							{
								"type": "mrkdwn",
								"text": fmt.Sprintf("*Metric*\n%s", strings.ToUpper(n.Metric)),
							},
							{
								"type": "mrkdwn",
								"text": fmt.Sprintf("*Current*\n%.1f%%", n.Value),
							},
							{
								"type": "mrkdwn",
								"text": fmt.Sprintf("*Threshold*\n%.1f%%", n.Threshold),
							},
							{
								"type": "mrkdwn",
								"text": fmt.Sprintf("*Severity*\n%s", strings.ToUpper(n.Severity)),
							},
						},
					},
					{
						"type": "context",
						"elements": []map[string]interface{}{
							{
								"type": "mrkdwn",
								"text": fmt.Sprintf("%s • %s", ProductName, n.Time.Format("2006-01-02 15:04:05")),
							},
						},
					},
				},
			},
		},
	}
}
