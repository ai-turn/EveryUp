package alerter

import (
	"fmt"
	"net/url"
	"strings"
)

// allowedWebhookDomains maps channel types to their allowed webhook domains.
var allowedWebhookDomains = map[string][]string{
	"discord": {
		"discord.com",
		"discordapp.com",
		"canary.discord.com",
		"ptb.discord.com",
	},
	"slack": {
		"hooks.slack.com",
	},
}

// ValidateWebhookURL checks that a webhook URL belongs to the expected service domain.
// This prevents SSRF attacks where a user could point a webhook to an internal service.
func ValidateWebhookURL(channelType, webhookURL string) error {
	if webhookURL == "" {
		return fmt.Errorf("webhook URL is required")
	}

	parsed, err := url.Parse(webhookURL)
	if err != nil {
		return fmt.Errorf("invalid webhook URL: %w", err)
	}

	// Only HTTPS is allowed for webhooks
	if parsed.Scheme != "https" {
		return fmt.Errorf("webhook URL must use HTTPS")
	}

	// Check domain against allowed list
	domains, exists := allowedWebhookDomains[channelType]
	if !exists {
		// No domain restriction for unknown types (e.g. custom endpoint channels)
		return nil
	}

	hostname := strings.ToLower(parsed.Hostname())
	for _, domain := range domains {
		if hostname == domain || strings.HasSuffix(hostname, "."+domain) {
			return nil
		}
	}

	return fmt.Errorf("webhook URL domain '%s' is not allowed for %s (expected: %s)",
		hostname, channelType, strings.Join(domains, ", "))
}
