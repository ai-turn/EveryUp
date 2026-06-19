package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// AlertRuleHandler handles alert rule CRUD operations
type AlertRuleHandler struct {
	repo *database.AlertRuleRepository
}

// NewAlertRuleHandler creates a new alert rule handler
func NewAlertRuleHandler() *AlertRuleHandler {
	return &AlertRuleHandler{
		repo: database.NewAlertRuleRepository(),
	}
}

// GetAll returns all alert rules
func (h *AlertRuleHandler) GetAll(c *fiber.Ctx) error {
	rules, err := h.repo.GetAll()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_ERROR",
				"message": "Failed to fetch alert rules",
			},
		})
	}
	if rules == nil {
		rules = []models.AlertRule{}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    rules,
	})
}

// GetByID returns a single alert rule
func (h *AlertRuleHandler) GetByID(c *fiber.Ctx) error {
	id := c.Params("id")

	rule, err := h.repo.GetByID(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_ERROR",
				"message": "Failed to fetch alert rule",
			},
		})
	}
	if rule == nil {
		return c.Status(404).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "NOT_FOUND",
				"message": "Alert rule not found",
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    rule,
	})
}

// Create creates a new alert rule
func (h *AlertRuleHandler) Create(c *fiber.Ctx) error {
	var req models.AlertRuleCreateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_REQUEST",
				"message": "Invalid request body",
			},
		})
	}

	// Validate field lengths
	if len(req.Name) > 200 || len(req.Message) > 1000 {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "VALIDATION_ERROR",
				"message": "name (max 200) or message (max 1000) exceeds maximum length",
			},
		})
	}

	// Validate required fields
	if req.Name == "" {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "VALIDATION_ERROR",
				"message": "name is required",
			},
		})
	}
	if req.Type == "" {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "VALIDATION_ERROR",
				"message": "type is required",
			},
		})
	}
	if req.Metric == "" {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "VALIDATION_ERROR",
				"message": "metric is required",
			},
		})
	}

	rule := req.ToAlertRule(uuid.New().String())

	if err := h.repo.Create(rule); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "CREATE_ERROR",
				"message": "Failed to create alert rule",
			},
		})
	}

	// Re-fetch to include channel IDs
	created, _ := h.repo.GetByID(rule.ID)
	if created == nil {
		created = rule
	}

	return c.Status(201).JSON(fiber.Map{
		"success": true,
		"data":    created,
	})
}

// Update updates an existing alert rule
func (h *AlertRuleHandler) Update(c *fiber.Ctx) error {
	id := c.Params("id")

	existing, err := h.repo.GetByID(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_ERROR",
				"message": "Failed to fetch alert rule",
			},
		})
	}
	if existing == nil {
		return c.Status(404).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "NOT_FOUND",
				"message": "Alert rule not found",
			},
		})
	}

	var req models.AlertRuleUpdateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_REQUEST",
				"message": "Invalid request body",
			},
		})
	}

	if err := h.repo.Update(id, &req); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "UPDATE_ERROR",
				"message": "Failed to update alert rule",
			},
		})
	}

	updated, _ := h.repo.GetByID(id)
	return c.JSON(fiber.Map{
		"success": true,
		"data":    updated,
	})
}

// Delete deletes an alert rule
func (h *AlertRuleHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")

	existing, err := h.repo.GetByID(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_ERROR",
				"message": "Failed to fetch alert rule",
			},
		})
	}
	if existing == nil {
		return c.Status(404).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "NOT_FOUND",
				"message": "Alert rule not found",
			},
		})
	}

	if existing.IsSystem {
		return c.Status(403).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FORBIDDEN",
				"message": "System rules cannot be deleted",
			},
		})
	}

	if err := h.repo.Delete(id); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "DELETE_ERROR",
				"message": "Failed to delete alert rule",
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    nil,
	})
}

// Toggle toggles the is_enabled flag for an alert rule
func (h *AlertRuleHandler) Toggle(c *fiber.Ctx) error {
	id := c.Params("id")

	existing, err := h.repo.GetByID(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_ERROR",
				"message": "Failed to fetch alert rule",
			},
		})
	}
	if existing == nil {
		return c.Status(404).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "NOT_FOUND",
				"message": "Alert rule not found",
			},
		})
	}

	newEnabled := !existing.IsEnabled
	if err := h.repo.SetEnabled(id, newEnabled); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "UPDATE_ERROR",
				"message": "Failed to toggle alert rule",
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"id":        id,
			"isEnabled": newEnabled,
		},
	})
}
