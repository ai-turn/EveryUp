package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/aiturn/everyup/internal/database"
)

// IncidentHandler handles incident-related requests
type IncidentHandler struct {
	repo *database.IncidentRepository
}

// NewIncidentHandler creates a new incident handler
func NewIncidentHandler() *IncidentHandler {
	return &IncidentHandler{
		repo: database.NewIncidentRepository(),
	}
}

// GetAll returns all incidents
func (h *IncidentHandler) GetAll(c *fiber.Ctx) error {
	incidents, err := h.repo.GetActive()
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    incidents,
	})
}

// GetActive returns active incidents
func (h *IncidentHandler) GetActive(c *fiber.Ctx) error {
	return h.GetAll(c)
}
