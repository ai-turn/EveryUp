package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/aiturn/everyup/internal/database"
)

// DashboardHandler handles dashboard-related requests
type DashboardHandler struct {
	incidentRepo *database.IncidentRepository
}

// NewDashboardHandler creates a new dashboard handler
func NewDashboardHandler() *DashboardHandler {
	return &DashboardHandler{
		incidentRepo: database.NewIncidentRepository(),
	}
}

// GetTimeline returns recent events timeline
func (h *DashboardHandler) GetTimeline(c *fiber.Ctx) error {
	limit := 5

	events, err := h.incidentRepo.GetTimeline(limit)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    events,
	})
}

// GetIncidents returns all incidents
func (h *DashboardHandler) GetIncidents(c *fiber.Ctx) error {
	incidents, err := h.incidentRepo.GetActive()
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    incidents,
	})
}
