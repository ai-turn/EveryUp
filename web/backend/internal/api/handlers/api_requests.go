package handlers

import (
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/alerter"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
)

// ApiRequestsHandler handles API request projection queries.
type ApiRequestsHandler struct {
	repo         *database.ApiRequestRepository
	ruleRepo     *database.AlertRuleRepository
	alertManager *alerter.Manager
}

// NewApiRequestsHandler creates a new ApiRequestsHandler.
func NewApiRequestsHandler() *ApiRequestsHandler {
	return &ApiRequestsHandler{
		repo:         database.NewApiRequestRepository(),
		ruleRepo:     database.NewAlertRuleRepository(),
		alertManager: alerter.NewManager(),
	}
}

// evaluateApiRequestAlerts dispatches API-status alerts for the exact direct
// or Agent-discovered service plus global rules.
func (h *ApiRequestsHandler) evaluateApiRequestAlerts(serviceID, agentID, serviceName string, batch []models.ApiRequest) {
	rules, err := h.ruleRepo.GetEnabledApiRequestRules(serviceID, agentID, serviceName)
	if err != nil {
		log.Printf("[ApiRequestIngest] Failed to load API request rules for %s: %v", serviceName, err)
		return
	}
	if len(rules) == 0 {
		return
	}

	alertServiceID := agentID
	if serviceID != "" {
		alertServiceID = serviceID
	}
	for _, entry := range batch {
		for _, rule := range rules {
			if !compareAlertValue(float64(entry.StatusCode), rule.Operator, rule.Threshold) {
				continue
			}
			go h.alertManager.DispatchApiRequestAlertForRule(
				rule,
				alertServiceID,
				entry.ServiceName,
				entry.Method,
				entry.Path,
				entry.StatusCode,
				float64(entry.DurationMs),
			)
		}
	}
}

// List handles GET /api/v1/services/:id/api-requests.
func (h *ApiRequestsHandler) List(c *fiber.Ctx) error {
	serviceID := c.Params("id")

	filter := &models.ApiRequestFilter{ServiceID: serviceID}

	if v := c.Query("method"); v != "" {
		filter.Methods = []string{strings.ToUpper(v)}
	}
	if v := c.QueryInt("minStatus"); v > 0 {
		filter.MinStatus = v
	}
	if v := c.QueryInt("maxStatus"); v > 0 {
		filter.MaxStatus = v
	}
	if v := c.Query("pathPrefix"); v != "" {
		filter.PathPrefix = v
	}
	if v := c.Query("search"); v != "" {
		filter.Search = v
	}
	if v := c.Query("traceId"); v != "" {
		filter.TraceID = v
	}
	if c.Query("errorsOnly") == "true" {
		filter.ErrorsOnly = true
	}
	if v := c.Query("from"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			filter.From = t
		}
	}
	if v := c.Query("to"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			filter.To = t
		}
	}
	if v := c.QueryInt("limit"); v > 0 {
		if v > 200 {
			v = 200
		}
		filter.Limit = v
	}
	if v := c.QueryInt("offset"); v > 0 {
		filter.Offset = v
	}

	items, total, err := h.repo.List(filter)
	if err != nil {
		return internalError(c, ErrCodeFetch, err)
	}
	if items == nil {
		items = []models.ApiRequest{}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"items": items,
			"total": total,
		},
	})
}

// GetByID handles GET /api/v1/services/:id/api-requests/:reqId.
func (h *ApiRequestsHandler) GetByID(c *fiber.Ctx) error {
	reqIDStr := c.Params("reqId")
	reqID, err := strconv.ParseInt(reqIDStr, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeInvalidRequest,
				"message": genericMessage(ErrCodeInvalidRequest),
			},
		})
	}

	req, err := h.repo.GetByID(reqID)
	if err != nil {
		return internalError(c, ErrCodeFetch, err)
	}
	if req == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeNotFound,
				"message": genericMessage(ErrCodeNotFound),
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    req,
	})
}
