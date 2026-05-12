package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// LogHandler handles log-related requests
type LogHandler struct {
	repo *database.LogRepository
}

// NewLogHandler creates a new log handler
func NewLogHandler() *LogHandler {
	return &LogHandler{
		repo: database.NewLogRepository(),
	}
}

// GetAll returns logs with filters and pagination
func (h *LogHandler) GetAll(c *fiber.Ctx) error {
	filter := models.LogFilter{
		ServiceID: c.Query("serviceId"),
		Level:     models.LogLevel(c.Query("level")),
		Search:    c.Query("search"),
		TraceID:   c.Query("traceId"),
	}

	// Parse pagination
	if limit := c.Query("limit"); limit != "" {
		if parsed, err := strconv.Atoi(limit); err == nil {
			filter.Limit = parsed
		}
	}
	if filter.Limit <= 0 {
		filter.Limit = 50
	}
	if filter.Limit > 1000 {
		filter.Limit = 1000
	}

	if offset := c.Query("offset"); offset != "" {
		if parsed, err := strconv.Atoi(offset); err == nil {
			filter.Offset = parsed
		}
	}

	// Parse page number (alternative to offset)
	if page := c.Query("page"); page != "" {
		if parsed, err := strconv.Atoi(page); err == nil && parsed > 0 {
			filter.Offset = (parsed - 1) * filter.Limit
		}
	}

	logs, total, err := h.repo.GetAll(filter)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	// Calculate pagination info
	totalPages := total / filter.Limit
	if total%filter.Limit > 0 {
		totalPages++
	}
	currentPage := (filter.Offset / filter.Limit) + 1

	return c.JSON(fiber.Map{
		"success": true,
		"data":    logs,
		"pagination": fiber.Map{
			"page":       currentPage,
			"limit":      filter.Limit,
			"total":      total,
			"totalPages": totalPages,
		},
	})
}

// GetByServiceID returns logs for a specific service
func (h *LogHandler) GetByServiceID(c *fiber.Ctx) error {
	serviceID := c.Params("id")

	filter := models.LogFilter{
		ServiceID: serviceID,
		Level:     models.LogLevel(c.Query("level")),
		Search:    c.Query("search"),
		TraceID:   c.Query("traceId"),
		Limit:     50,
	}

	if limit := c.Query("limit"); limit != "" {
		if parsed, err := strconv.Atoi(limit); err == nil {
			filter.Limit = parsed
		}
	}

	logs, total, err := h.repo.GetAll(filter)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    logs,
		"total":   total,
	})
}
