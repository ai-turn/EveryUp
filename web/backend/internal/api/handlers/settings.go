package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/aiturn/everyup/internal/config"
)

// SettingsHandler handles system settings requests
type SettingsHandler struct{}

// NewSettingsHandler creates a new settings handler
func NewSettingsHandler() *SettingsHandler {
	return &SettingsHandler{}
}

// Get returns the current mutable system settings
func (h *SettingsHandler) Get(c *fiber.Ctx) error {
	cfg := config.Get()
	if cfg == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeConfigUnavailable,
				"message": genericMessage(ErrCodeConfigUnavailable),
			},
		})
	}
	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"alerts": fiber.Map{
				"consecutiveFailures": cfg.Alerts.ConsecutiveFailures,
			},
			"retention": fiber.Map{
				"metrics": cfg.Retention.Metrics,
				"logs":    cfg.Retention.Logs,
			},
		},
	})
}

// UpdateSettingsRequest is the request body for updating settings
type UpdateSettingsRequest struct {
	Alerts *struct {
		ConsecutiveFailures int `json:"consecutiveFailures"`
	} `json:"alerts"`
	Retention *struct {
		Metrics string `json:"metrics"`
		Logs    string `json:"logs"`
	} `json:"retention"`
}

// Update updates mutable system settings
func (h *SettingsHandler) Update(c *fiber.Ctx) error {
	cfg := config.Get()
	if cfg == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeConfigUnavailable,
				"message": genericMessage(ErrCodeConfigUnavailable),
			},
		})
	}

	var req UpdateSettingsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeInvalidRequest,
				"message": genericMessage(ErrCodeInvalidRequest),
			},
		})
	}

	// Read current values as defaults
	consecutiveFailures := cfg.Alerts.ConsecutiveFailures
	metricsRetention := cfg.Retention.Metrics
	logsRetention := cfg.Retention.Logs

	// Apply provided fields
	if req.Alerts != nil {
		if req.Alerts.ConsecutiveFailures > 0 {
			consecutiveFailures = req.Alerts.ConsecutiveFailures
		}
	}
	if req.Retention != nil {
		if req.Retention.Metrics != "" {
			metricsRetention = req.Retention.Metrics
		}
		if req.Retention.Logs != "" {
			logsRetention = req.Retention.Logs
		}
	}

	if err := config.UpdateSettings(consecutiveFailures, metricsRetention, logsRetention); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeUpdateFailed,
				"message": genericMessage(ErrCodeUpdateFailed),
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"alerts": fiber.Map{
				"consecutiveFailures": consecutiveFailures,
			},
			"retention": fiber.Map{
				"metrics": metricsRetention,
				"logs":    logsRetention,
			},
		},
	})
}
