package handlers

import (
	"github.com/gofiber/fiber/v2"

	"github.com/aiturn/everyup/internal/database"
)

// TracesHandler exposes trace correlation reads.
type TracesHandler struct {
	spanRepo *database.SpanRepository
	logRepo  *database.LogRepository
	reqRepo  *database.ApiRequestRepository
}

// NewTracesHandler creates a TracesHandler.
func NewTracesHandler() *TracesHandler {
	return &TracesHandler{
		spanRepo: database.NewSpanRepository(),
		logRepo:  database.NewLogRepository(),
		reqRepo:  database.NewApiRequestRepository(),
	}
}

// GetByTraceID handles GET /api/v1/traces/:traceId. Returns the spans, logs,
// and api_requests projections that share the trace ID. Empty arrays — not
// 404 — when nothing matches; clients distinguish "no data yet" from "trace
// gone" by inspecting array lengths.
func (h *TracesHandler) GetByTraceID(c *fiber.Ctx) error {
	traceID := c.Params("traceId")
	if traceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeInvalidRequest,
				"message": "traceId path parameter is required",
			},
		})
	}

	spans, err := h.spanRepo.GetByTraceID(traceID)
	if err != nil {
		return internalError(c, ErrCodeFetch, err)
	}
	logs, err := h.logRepo.GetByTraceID(traceID)
	if err != nil {
		return internalError(c, ErrCodeFetch, err)
	}
	apiReqs, err := h.reqRepo.GetByTraceID(traceID)
	if err != nil {
		return internalError(c, ErrCodeFetch, err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"traceId":     traceID,
			"spans":       defaultEmptySlice(spans),
			"logs":        defaultEmptySlice(logs),
			"apiRequests": defaultEmptySlice(apiReqs),
		},
	})
}

// defaultEmptySlice substitutes a non-nil empty slice for nil so the JSON
// response always serializes [] instead of null.
func defaultEmptySlice[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}
