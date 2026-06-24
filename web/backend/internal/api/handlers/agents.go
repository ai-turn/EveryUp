package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/alerter"
	"github.com/aiturn/everyup/internal/crypto"
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

// extractBearerToken pulls the token from "Authorization: Bearer <token>".
func extractBearerToken(c *fiber.Ctx) string {
	parts := strings.SplitN(c.Get("Authorization"), " ", 2)
	if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
		return strings.TrimSpace(parts[1])
	}
	return ""
}

// requireAgentKey authenticates a sync request by matching the Bearer token hash
// to the agent identified by :agentId in the URL path.
func (h *AgentHandler) requireAgentKey(c *fiber.Ctx) error {
	token := extractBearerToken(c)
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "UNAUTHORIZED", "message": "missing agent API key"},
		})
	}
	agent, found, err := h.repo.FindAgentByKeyHash(hashAgentKey(token))
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if !found || agent.ID != c.Params("agentId") {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "UNAUTHORIZED", "message": "invalid agent API key"},
		})
	}
	return nil
}

func (h *AgentHandler) Enroll(c *fiber.Ctx) error {
	token := extractBearerToken(c)
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "UNAUTHORIZED", "message": "missing agent API key"},
		})
	}
	agent, found, err := h.repo.FindAgentByKeyHash(hashAgentKey(token))
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if !found {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "UNAUTHORIZED", "message": "invalid agent API key"},
		})
	}
	// Update version from request body if provided.
	var req agentEnrollRequest
	if err := c.BodyParser(&req); err == nil && req.Version != "" {
		_ = h.repo.UpsertAgent(models.Agent{
			ID:         agent.ID,
			Name:       agent.Name,
			Mode:       agent.Mode,
			Version:    req.Version,
			LastSeenAt: time.Now(),
		})
	}
	return c.JSON(agentEnrollResponse{AgentID: agent.ID})
}

func (h *AgentHandler) SyncServices(c *fiber.Ctx) error {
	if err := h.requireAgentKey(c); err != nil {
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
	if err := h.requireAgentKey(c); err != nil {
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
	if err := h.requireAgentKey(c); err != nil {
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

// generateAgentKey creates a random key with prefix "evup_svc_" and returns (plaintext, sha256hex).
func generateAgentKey() (string, string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", "", fmt.Errorf("rand: %w", err)
	}
	plain := "evup_svc_" + hex.EncodeToString(b)
	sum := sha256.Sum256([]byte(plain))
	return plain, hex.EncodeToString(sum[:]), nil
}

// hashAgentKey returns the SHA-256 hex digest of a plaintext key.
func hashAgentKey(key string) string {
	sum := sha256.Sum256([]byte(key))
	return hex.EncodeToString(sum[:])
}

// Create pre-registers a new service (agent) from the web UI and returns its API key once.
func (h *AgentHandler) Create(c *fiber.Ctx) error {
	var req struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return agentBadRequest(c, "INVALID_REQUEST", "invalid request body")
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return agentBadRequest(c, "VALIDATION_ERROR", "name is required")
	}

	plain, hash, err := generateAgentKey()
	if err != nil {
		return internalError(c, "KEY_GENERATION_ERROR", err)
	}
	keyEnc, err := crypto.Encrypt(plain)
	if err != nil {
		return internalError(c, ErrCodeSecret, err)
	}

	agent := models.Agent{
		ID:   "agent_" + uuid.NewString(),
		Name: req.Name,
		Mode: "standalone",
	}
	if err := h.repo.CreateAgent(agent, hash, keyEnc); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"id":     agent.ID,
			"name":   agent.Name,
			"apiKey": plain, // returned once only
		},
	})
}

// Delete deactivates an agent (service), revoking its API key without deleting data.
func (h *AgentHandler) Delete(c *fiber.Ctx) error {
	if err := h.repo.DeactivateAgent(c.Params("agentId")); err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"error":   fiber.Map{"code": "NOT_FOUND", "message": "agent not found"},
			})
		}
		return internalError(c, "DATABASE_ERROR", err)
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

// GetKey returns the agent's full API key (decrypted) for display in the UI.
// available is false for agents created before key storage existed — those have
// only the hash and must be rotated to obtain a viewable key.
func (h *AgentHandler) GetKey(c *fiber.Ctx) error {
	enc, found, err := h.repo.GetAgentKeyEnc(c.Params("agentId"))
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	if !found {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": ErrCodeNotFound, "message": "agent not found"},
		})
	}
	if enc == "" {
		return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"apiKey": "", "available": false}})
	}
	plain, err := crypto.Decrypt(enc)
	if err != nil {
		return internalError(c, ErrCodeSecret, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"apiKey": plain, "available": true}})
}

// RotateKey issues a new API key for an agent, invalidating the previous one.
func (h *AgentHandler) RotateKey(c *fiber.Ctx) error {
	plain, hash, err := generateAgentKey()
	if err != nil {
		return internalError(c, "KEY_GENERATION_ERROR", err)
	}
	keyEnc, err := crypto.Encrypt(plain)
	if err != nil {
		return internalError(c, ErrCodeSecret, err)
	}
	if err := h.repo.UpdateAgentKey(c.Params("agentId"), hash, keyEnc); err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"error":   fiber.Map{"code": ErrCodeNotFound, "message": "agent not found"},
			})
		}
		return internalError(c, ErrCodeDatabase, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"apiKey": plain}})
}

func (h *AgentHandler) GetServices(c *fiber.Ctx) error {
	services, err := h.repo.GetServices(c.Params("agentId"))
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": services})
}

func (h *AgentHandler) DeleteService(c *fiber.Ctx) error {
	agentID := c.Params("agentId")
	key := c.Params("key")
	if err := h.repo.DeleteService(agentID, key); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.SendStatus(fiber.StatusNoContent)
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
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	filter := models.LogFilter{
		ServiceName: service.Name,
		Level:       models.LogLevel(c.Query("level")),
		Search:      c.Query("search"),
		Limit:       limit,
		Offset:      offset,
	}
	if from := c.Query("from"); from != "" {
		if t, err2 := time.Parse(time.RFC3339, from); err2 == nil {
			filter.From = t
		}
	}
	if to := c.Query("to"); to != "" {
		if t, err2 := time.Parse(time.RFC3339, to); err2 == nil {
			filter.To = t
		}
	}
	logs, total, err := h.logRepo.GetAll(filter)
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
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	minStatus, _ := strconv.Atoi(c.Query("minStatus", "0"))
	maxStatus, _ := strconv.Atoi(c.Query("maxStatus", "0"))
	filter := &models.ApiRequestFilter{
		ServiceName: service.Name,
		Search:      c.Query("search"),
		ErrorsOnly:  c.Query("errorsOnly") == "true",
		MinStatus:   minStatus,
		MaxStatus:   maxStatus,
		Limit:       limit,
		Offset:      offset,
	}
	if from := c.Query("from"); from != "" {
		if t, err2 := time.Parse(time.RFC3339, from); err2 == nil {
			filter.From = t
		}
	}
	if to := c.Query("to"); to != "" {
		if t, err2 := time.Parse(time.RFC3339, to); err2 == nil {
			filter.To = t
		}
	}
	requests, total, err := h.reqRepo.List(filter)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": requests, "total": total})
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
