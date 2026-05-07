package handlers

import (
	"database/sql"
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// ApiCaptureConfigHandler handles per-service API capture config operations.
type ApiCaptureConfigHandler struct {
	serviceRepo *database.ServiceRepository
}

// NewApiCaptureConfigHandler creates a new ApiCaptureConfigHandler.
func NewApiCaptureConfigHandler() *ApiCaptureConfigHandler {
	return &ApiCaptureConfigHandler{
		serviceRepo: database.NewServiceRepository(),
	}
}

// GetConfig handles GET /api/v1/services/:id/api-capture-config.
func (h *ApiCaptureConfigHandler) GetConfig(c *fiber.Ctx) error {
	serviceID := c.Params("id")

	cfg, err := h.serviceRepo.GetApiCaptureConfig(serviceID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    ErrCodeNotFound,
					"message": genericMessage(ErrCodeNotFound),
				},
			})
		}
		return internalError(c, ErrCodeFetch, err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    cfg,
	})
}

// UpdateConfig handles PUT /api/v1/services/:id/api-capture-config.
func (h *ApiCaptureConfigHandler) UpdateConfig(c *fiber.Ctx) error {
	serviceID := c.Params("id")

	var input models.ApiCaptureConfig
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeInvalidRequest,
				"message": genericMessage(ErrCodeInvalidRequest),
			},
		})
	}

	if input.Mode == "" {
		input.Mode = models.DefaultApiCaptureConfig().Mode
	}

	switch input.Mode {
	case models.CaptureModeDisabled,
		models.CaptureModeErrorsOnly,
		models.CaptureModeSampled,
		models.CaptureModeAll:
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeValidation,
				"message": "mode must be one of: disabled, errors_only, sampled, all",
			},
		})
	}

	if input.SampleRate < 0 || input.SampleRate > 100 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeValidation,
				"message": "sampleRate must be between 0 and 100",
			},
		})
	}

	if err := h.serviceRepo.UpdateApiCaptureConfig(serviceID, &input); err != nil {
		return internalError(c, ErrCodeUpdate, err)
	}

	saved, err := h.serviceRepo.GetApiCaptureConfig(serviceID)
	if err != nil {
		return internalError(c, ErrCodeFetch, err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    saved,
	})
}
