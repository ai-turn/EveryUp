package handlers

import (
	"encoding/json"
	"time"

	"github.com/aiturn/everyup/internal/alerter"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// NotificationHandler handles notification channel operations
type NotificationHandler struct {
	repo    *database.NotificationRepository
	manager *alerter.Manager
}

// NewNotificationHandler creates a new notification handler
func NewNotificationHandler() *NotificationHandler {
	return &NotificationHandler{
		repo:    database.NewNotificationRepository(),
		manager: alerter.NewManager(),
	}
}

// GetAll returns all notification channels
func (h *NotificationHandler) GetAll(c *fiber.Ctx) error {
	channels, err := h.repo.GetAll()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_ERROR",
				"message": "Failed to fetch notification channels",
			},
		})
	}

	masked := make([]models.NotificationChannel, len(channels))
	for i := range channels {
		masked[i] = channels[i].MaskConfig()
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    masked,
	})
}

// Create creates a new notification channel
func (h *NotificationHandler) Create(c *fiber.Ctx) error {
	var req models.NotificationChannelCreateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_REQUEST",
				"message": "Invalid request body",
			},
		})
	}

	// Validate type
	if req.Type != "telegram" && req.Type != "discord" && req.Type != "slack" {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_TYPE",
				"message": "Type must be 'telegram', 'discord', or 'slack'",
			},
		})
	}

	// Marshal config to JSON
	configJSON, err := json.Marshal(req.Config)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_CONFIG",
				"message": "Invalid configuration",
			},
		})
	}

	// Validate webhook URL for SSRF protection
	if err := validateChannelWebhookURL(req.Type, configJSON); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "SSRF_BLOCKED",
				"message": err.Error(),
			},
		})
	}

	channel := &models.NotificationChannel{
		ID:        uuid.New().String(),
		Name:      req.Name,
		Type:      req.Type,
		Config:    string(configJSON),
		IsEnabled: true,
		CreatedAt: time.Now(),
	}

	if err := h.repo.Create(channel); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "CREATE_ERROR",
				"message": "Failed to create notification channel",
			},
		})
	}

	return c.Status(201).JSON(fiber.Map{
		"success": true,
		"data":    channel.MaskConfig(),
	})
}

// Test sends a test notification
func (h *NotificationHandler) Test(c *fiber.Ctx) error {
	id := c.Params("id")

	channel, err := h.repo.GetByID(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_ERROR",
				"message": "Failed to fetch channel",
			},
		})
	}

	if channel == nil {
		return c.Status(404).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "NOT_FOUND",
				"message": "Channel not found",
			},
		})
	}

	// Create test notification
	notification := alerter.Notification{
		ServiceID:   "test",
		ServiceName: "Notification Test",
		Status:      models.StatusHealthy,
		Message:     "This is a test notification. Your EVERYUP notification channel is connected correctly.",
		Time:        time.Now(),
	}

	// Send via manager
	var provider alerter.AlertProvider
	switch channel.Type {
	case "discord":
		var config models.DiscordConfig
		if err := json.Unmarshal([]byte(channel.Config), &config); err != nil {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "INVALID_CONFIG",
					"message": "Invalid Discord configuration",
				},
			})
		}
		provider = alerter.NewDiscordProvider(config.WebhookURL)

	case "telegram":
		var config models.TelegramConfig
		if err := json.Unmarshal([]byte(channel.Config), &config); err != nil {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "INVALID_CONFIG",
					"message": "Invalid Telegram configuration",
				},
			})
		}
		provider = alerter.NewTelegramProvider(config.BotToken, config.ChatID)

	case "slack":
		var config models.SlackConfig
		if err := json.Unmarshal([]byte(channel.Config), &config); err != nil {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "INVALID_CONFIG",
					"message": "Invalid Slack configuration",
				},
			})
		}
		provider = alerter.NewSlackProvider(config.WebhookURL)

	default:
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "UNSUPPORTED_TYPE",
				"message": "Unsupported channel type: " + channel.Type,
			},
		})
	}

	if err := provider.Send(notification); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "SEND_ERROR",
				"message": err.Error(),
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Test notification sent successfully",
	})
}

// Update updates a notification channel
func (h *NotificationHandler) Update(c *fiber.Ctx) error {
	id := c.Params("id")

	channel, err := h.repo.GetByID(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_ERROR",
				"message": "Failed to fetch channel",
			},
		})
	}

	if channel == nil {
		return c.Status(404).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "NOT_FOUND",
				"message": "Channel not found",
			},
		})
	}

	var req models.NotificationChannelCreateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_REQUEST",
				"message": "Invalid request body",
			},
		})
	}

	// Validate type
	if req.Type != "telegram" && req.Type != "discord" && req.Type != "slack" {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_TYPE",
				"message": "Type must be 'telegram', 'discord', or 'slack'",
			},
		})
	}

	// Marshal config to JSON
	configJSON, err := json.Marshal(req.Config)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_CONFIG",
				"message": "Invalid configuration",
			},
		})
	}

	// Validate webhook URL for SSRF protection
	if err := validateChannelWebhookURL(req.Type, configJSON); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "SSRF_BLOCKED",
				"message": err.Error(),
			},
		})
	}

	channel.Name = req.Name
	channel.Type = req.Type
	channel.Config = string(configJSON)

	if err := h.repo.Update(channel); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "UPDATE_ERROR",
				"message": "Failed to update notification channel",
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    channel.MaskConfig(),
	})
}

// Toggle toggles the enabled state of a notification channel
func (h *NotificationHandler) Toggle(c *fiber.Ctx) error {
	id := c.Params("id")

	channel, err := h.repo.GetByID(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_ERROR",
				"message": "Failed to fetch channel",
			},
		})
	}

	if channel == nil {
		return c.Status(404).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "NOT_FOUND",
				"message": "Channel not found",
			},
		})
	}

	newState := !channel.IsEnabled
	if err := h.repo.SetEnabled(id, newState); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "TOGGLE_ERROR",
				"message": "Failed to toggle notification channel",
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"id":        id,
			"isEnabled": newState,
		},
	})
}

// Delete deletes a notification channel
func (h *NotificationHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")

	if err := h.repo.Delete(id); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "DELETE_ERROR",
				"message": "Failed to delete notification channel",
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Notification channel deleted successfully",
	})
}

// validateChannelWebhookURL extracts and validates webhook URLs from channel config JSON.
func validateChannelWebhookURL(channelType string, configJSON []byte) error {
	switch channelType {
	case "discord":
		var cfg models.DiscordConfig
		if err := json.Unmarshal(configJSON, &cfg); err != nil {
			return nil // config parse errors are handled elsewhere
		}
		return alerter.ValidateWebhookURL("discord", cfg.WebhookURL)
	case "slack":
		var cfg models.SlackConfig
		if err := json.Unmarshal(configJSON, &cfg); err != nil {
			return nil
		}
		if cfg.WebhookURL != "" {
			return alerter.ValidateWebhookURL("slack", cfg.WebhookURL)
		}
	}
	return nil
}
