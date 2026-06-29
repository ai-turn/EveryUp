package handlers

import (
	"github.com/gofiber/fiber/v2"

	"github.com/aiturn/everyup/internal/crypto"
	"github.com/aiturn/everyup/internal/database"
)

// AuditHandler exposes read access to the sensitive-action audit trail.
type AuditHandler struct {
	auditRepo *database.AuditRepository
}

// NewAuditHandler creates an AuditHandler.
func NewAuditHandler() *AuditHandler {
	return &AuditHandler{auditRepo: database.NewAuditRepository()}
}

// GetAll handles GET /api/v1/audit. Admin-only: the audit trail records who
// viewed captured request/response bodies, so reading it is itself privileged.
// Optional ?action= filter and ?limit= (default 100, max 500).
func (h *AuditHandler) GetAll(c *fiber.Ctx) error {
	claims, _ := c.Locals("claims").(*crypto.UserClaims)
	if claims == nil || claims.Role != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeForbidden,
				"message": "admin role required",
			},
		})
	}

	events, err := h.auditRepo.GetRecent(c.Query("action"), c.QueryInt("limit", 100))
	if err != nil {
		return internalError(c, ErrCodeFetch, err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    defaultEmptySlice(events),
	})
}
