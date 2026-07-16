package handlers

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// ServiceHandler handles service-related requests
type ServiceHandler struct {
	repo       *database.ServiceRepository
	metricRepo *database.MetricRepository
}

// NewServiceHandler creates a new service handler
func NewServiceHandler() *ServiceHandler {
	return &ServiceHandler{
		repo:       database.NewServiceRepository(),
		metricRepo: database.NewMetricRepository(),
	}
}

// GetAll returns all services, optionally filtered by ?type=http,tcp
func (h *ServiceHandler) GetAll(c *fiber.Ctx) error {
	var typeFilter []string
	if typeParam := c.Query("type"); typeParam != "" {
		typeFilter = strings.Split(typeParam, ",")
	}

	services, err := h.repo.GetAll(typeFilter...)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	// Fetch sparkline data for all services in one batch query
	sparklines, _ := h.metricRepo.GetRecentResponseTimesBatch(24)

	// Enrich services: status from isActive (live monitoring on/off), metrics for uptime/latency
	for i := range services {
		// Status = is monitoring live?
		if services[i].IsActive {
			services[i].Status = models.StatusHealthy
		} else {
			services[i].Status = models.StatusUnknown
		}

		// Log services have no metrics — skip metric enrichment
		if services[i].Type == models.ServiceTypeLog {
			continue
		}

		// Attach sparkline history
		if hist, ok := sparklines[services[i].ID]; ok {
			services[i].LatencyHistory = hist
		}

		// Populate last check time and uptime/response time from metrics
		metrics, _ := h.metricRepo.GetByServiceID(services[i].ID, 1)
		if len(metrics) > 0 {
			services[i].LastCheckAt = &metrics[0].CheckedAt
		}
		summary, _ := h.metricRepo.GetSummary(services[i].ID, 24*time.Hour)
		if summary != nil {
			services[i].Uptime = summary.Uptime
			services[i].ResponseTime = int(summary.AvgResponseTime)
		}
	}

	// Clear hash from response — frontend uses apiKeyMasked instead
	for i := range services {
		services[i].ApiKey = ""
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    services,
	})
}

// GetByID returns a service by ID
func (h *ServiceHandler) GetByID(c *fiber.Ctx) error {
	id := c.Params("id")

	service, err := h.repo.GetByID(id)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	if service == nil {
		return c.Status(404).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "SERVICE_NOT_FOUND",
				"message": "Service not found",
			},
		})
	}

	// Status = is monitoring live?
	if service.IsActive {
		service.Status = models.StatusHealthy
	} else {
		service.Status = models.StatusUnknown
	}

	// Log services have no metrics — skip metric enrichment
	if service.Type != models.ServiceTypeLog {
		metrics, _ := h.metricRepo.GetByServiceID(service.ID, 1)
		if len(metrics) > 0 {
			service.LastCheckAt = &metrics[0].CheckedAt
		}
	}

	// Enrich with metrics summary
	summary, _ := h.metricRepo.GetSummary(service.ID, 24*time.Hour)
	if summary != nil {
		service.Uptime = summary.Uptime
		service.ResponseTime = int(summary.AvgResponseTime)
	}

	// Clear hash from response — frontend uses apiKeyMasked instead
	service.ApiKey = ""

	return c.JSON(fiber.Map{
		"success": true,
		"data":    service,
	})
}
