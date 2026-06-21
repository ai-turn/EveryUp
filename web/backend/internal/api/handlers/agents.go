package handlers

import (
	"crypto/subtle"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/alerter"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type AgentHandler struct {
	repo             *database.AgentRepository
	logRepo          *database.LogRepository
	reqRepo          *database.ApiRequestRepository
	ruleEvaluator    *alerter.RuleEvaluator
	serviceEvaluator *alerter.ServiceRuleEvaluator
}

func NewAgentHandler() *AgentHandler {
	return &AgentHandler{
		repo:    database.NewAgentRepository(),
		logRepo: database.NewLogRepository(),
		reqRepo: database.NewApiRequestRepository(),
	}
}

// SetEvaluators wires alert rule evaluators so agent syncs can trigger evaluation.
func (h *AgentHandler) SetEvaluators(rule *alerter.RuleEvaluator, svc *alerter.ServiceRuleEvaluator) {
	h.ruleEvaluator = rule
	h.serviceEvaluator = svc
}

type agentEnrollRequest struct {
	AgentName string `json:"agentName"`
	Mode      string `json:"mode"`
	Version   string `json:"version"`
}

type agentEnrollResponse struct {
	AgentID string `json:"agentId"`
}

type agentServicesRequest struct {
	AgentID    string                `json:"agentId"`
	AgentName  string                `json:"agentName"`
	ObservedAt time.Time             `json:"observedAt"`
	Services   []models.AgentService `json:"services"`
}

type agentEventsRequest struct {
	AgentID string              `json:"agentId"`
	Events  []models.AgentEvent `json:"events"`
}

type agentMetricsRequest struct {
	AgentID    string    `json:"agentId"`
	CPUUsage   float64   `json:"cpuUsage"`
	MemTotal   float64   `json:"memTotal"`
	MemUsed    float64   `json:"memUsed"`
	MemUsage   float64   `json:"memUsage"`
	DiskTotal  float64   `json:"diskTotal"`
	DiskUsed   float64   `json:"diskUsed"`
	DiskUsage  float64   `json:"diskUsage"`
	RecordedAt time.Time `json:"recordedAt"`
}

func (h *AgentHandler) Enroll(c *fiber.Ctx) error {
	if err := requireAgentToken(c); err != nil {
		return err
	}
	var req agentEnrollRequest
	if err := c.BodyParser(&req); err != nil {
		return agentBadRequest(c, "INVALID_REQUEST", err.Error())
	}
	req.AgentName = strings.TrimSpace(req.AgentName)
	if req.AgentName == "" {
		return agentBadRequest(c, "INVALID_REQUEST", "agentName is required")
	}
	req.Mode = strings.TrimSpace(req.Mode)
	if req.Mode == "" {
		req.Mode = "standalone"
	}
	agentID := "agent_" + uuid.NewString()
	if existing, found, err := h.repo.FindAgentByNameMode(req.AgentName, req.Mode); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	} else if found {
		agentID = existing.ID
	}
	if err := h.repo.UpsertAgent(models.Agent{
		ID:         agentID,
		Name:       req.AgentName,
		Mode:       req.Mode,
		Version:    req.Version,
		LastSeenAt: time.Now(),
	}); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(agentEnrollResponse{AgentID: agentID})
}

func (h *AgentHandler) SyncServices(c *fiber.Ctx) error {
	if err := requireAgentToken(c); err != nil {
		return err
	}
	agentID := c.Params("agentId")
	var req agentServicesRequest
	if err := c.BodyParser(&req); err != nil {
		return agentBadRequest(c, "INVALID_REQUEST", err.Error())
	}
	if req.AgentID != "" && req.AgentID != agentID {
		return agentBadRequest(c, "INVALID_REQUEST", "agentId mismatch")
	}
	if err := h.repo.UpsertServices(agentID, req.ObservedAt, req.Services); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if h.serviceEvaluator != nil {
		for _, svc := range req.Services {
			go h.serviceEvaluator.EvaluateAgent(agentID, svc.Key, svc.Name, svc.LastStatus, 0)
		}
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AgentHandler) SyncEvents(c *fiber.Ctx) error {
	if err := requireAgentToken(c); err != nil {
		return err
	}
	agentID := c.Params("agentId")
	var req agentEventsRequest
	if err := c.BodyParser(&req); err != nil {
		return agentBadRequest(c, "INVALID_REQUEST", err.Error())
	}
	if req.AgentID != "" && req.AgentID != agentID {
		return agentBadRequest(c, "INVALID_REQUEST", "agentId mismatch")
	}
	if err := h.repo.InsertEvents(agentID, req.Events); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AgentHandler) SyncMetrics(c *fiber.Ctx) error {
	if err := requireAgentToken(c); err != nil {
		return err
	}
	agentID := c.Params("agentId")
	var req agentMetricsRequest
	if err := c.BodyParser(&req); err != nil {
		return agentBadRequest(c, "INVALID_REQUEST", err.Error())
	}
	if req.AgentID != "" && req.AgentID != agentID {
		return agentBadRequest(c, "INVALID_REQUEST", "agentId mismatch")
	}
	if req.RecordedAt.IsZero() {
		req.RecordedAt = time.Now()
	}
	systemMetricRepo := database.NewSystemMetricRepository()
	metric := &models.SystemMetric{
		HostID:    agentID,
		CPUUsage:  req.CPUUsage,
		MemTotal:  req.MemTotal,
		MemUsed:   req.MemUsed,
		MemUsage:  req.MemUsage,
		DiskTotal: req.DiskTotal,
		DiskUsed:  req.DiskUsed,
		DiskUsage: req.DiskUsage,
		CreatedAt: req.RecordedAt,
	}
	if err := systemMetricRepo.Create(metric); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if h.ruleEvaluator != nil {
		go h.ruleEvaluator.EvaluateAgent(agentID, req.AgentID, metric)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AgentHandler) GetAll(c *fiber.Ctx) error {
	agents, err := h.repo.GetAllAgents()
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": agents})
}

func (h *AgentHandler) GetServices(c *fiber.Ctx) error {
	services, err := h.repo.GetServices(c.Params("agentId"))
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": services})
}

func (h *AgentHandler) GetEvents(c *fiber.Ctx) error {
	limit, _ := strconv.Atoi(c.Query("limit", "100"))
	events, err := h.repo.GetEvents(c.Params("agentId"), limit)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": events})
}

// GetAllServicesFlat returns all agent services across all agents with agent name included.
func (h *AgentHandler) GetAllServicesFlat(c *fiber.Ctx) error {
	services, err := h.repo.GetAllServicesFlat()
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": services})
}

// GetServiceHistory returns time-bucketed response-time history for one agent service.
func (h *AgentHandler) GetServiceHistory(c *fiber.Ctx) error {
	agentID := c.Params("agentId")
	key := c.Params("key")

	var since time.Time
	var bucketMins int
	switch c.Query("range", "24h") {
	case "12h":
		since = time.Now().Add(-12 * time.Hour)
		bucketMins = 10
	case "6h":
		since = time.Now().Add(-6 * time.Hour)
		bucketMins = 5
	default: // 24h
		since = time.Now().Add(-24 * time.Hour)
		bucketMins = 20
	}

	points, err := h.repo.GetServiceHistoryBuckets(agentID, key, since, bucketMins)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": points})
}

// GetServiceUptime returns per-day uptime percentages for one agent service.
func (h *AgentHandler) GetServiceUptime(c *fiber.Ctx) error {
	agentID := c.Params("agentId")
	key := c.Params("key")
	days, _ := strconv.Atoi(c.Query("days", "90"))
	if days <= 0 || days > 365 {
		days = 90
	}

	data, err := h.repo.GetServiceUptimeByDay(agentID, key, days)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": data})
}

// GetServiceKeyEvents returns agent_events filtered to a specific service key.
func (h *AgentHandler) GetServiceKeyEvents(c *fiber.Ctx) error {
	agentID := c.Params("agentId")
	key := c.Params("key")
	limit, _ := strconv.Atoi(c.Query("limit", "50"))

	events, err := h.repo.GetServiceKeyEvents(agentID, key, limit)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": events})
}

// GetServiceLogs returns logs for a service identified by agentId+key using service_name as the filter.
func (h *AgentHandler) GetServiceLogs(c *fiber.Ctx) error {
	agentID := c.Params("agentId")
	key := c.Params("key")

	service, err := h.repo.GetServiceByKey(agentID, key)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if service == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "NOT_FOUND", "message": "service not found"},
		})
	}

	limit, _ := strconv.Atoi(c.Query("limit", "100"))
	logs, total, err := h.logRepo.GetAll(models.LogFilter{
		ServiceName: service.Name,
		Limit:       limit,
	})
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": logs, "total": total})
}

// GetServiceRequests returns API requests for a service identified by agentId+key using service_name as the filter.
func (h *AgentHandler) GetServiceRequests(c *fiber.Ctx) error {
	agentID := c.Params("agentId")
	key := c.Params("key")

	service, err := h.repo.GetServiceByKey(agentID, key)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if service == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "NOT_FOUND", "message": "service not found"},
		})
	}

	limit, _ := strconv.Atoi(c.Query("limit", "100"))
	requests, total, err := h.reqRepo.List(&models.ApiRequestFilter{
		ServiceName: service.Name,
		Limit:       limit,
	})
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": requests, "total": total})
}

func requireAgentToken(c *fiber.Ctx) error {
	expected := strings.TrimSpace(os.Getenv("EVERYUP_AGENT_ENROLLMENT_TOKEN"))
	if expected == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "AGENT_TOKEN_NOT_CONFIGURED",
				"message": "EVERYUP_AGENT_ENROLLMENT_TOKEN is not configured",
			},
		})
	}
	auth := c.Get("Authorization")
	parts := strings.SplitN(auth, " ", 2)
	provided := ""
	if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
		provided = strings.TrimSpace(parts[1])
	}
	if subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) != 1 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "UNAUTHORIZED",
				"message": "Invalid agent enrollment token",
			},
		})
	}
	return nil
}

func agentBadRequest(c *fiber.Ctx, code, message string) error {
	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
		"success": false,
		"error": fiber.Map{
			"code":    code,
			"message": message,
		},
	})
}
