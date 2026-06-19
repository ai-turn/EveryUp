package handlers

import (
	"crypto/subtle"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type AgentHandler struct {
	repo *database.AgentRepository
}

func NewAgentHandler() *AgentHandler {
	return &AgentHandler{repo: database.NewAgentRepository()}
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
