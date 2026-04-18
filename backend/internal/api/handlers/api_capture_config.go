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

	// Parse body; missing fields use zero-values, which we then replace with defaults.
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

	// If mode is empty (not provided), fall back to default.
	if input.Mode == "" {
		input.Mode = models.DefaultApiCaptureConfig().Mode
	}

	// Validate mode.
	switch input.Mode {
	case models.CaptureModeDisabled,
		models.CaptureModeErrorsOnly,
		models.CaptureModeSampled,
		models.CaptureModeAll:
		// valid
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeValidation,
				"message": "mode must be one of: disabled, errors_only, sampled, all",
			},
		})
	}

	// Validate sampleRate: 0 ≤ value ≤ 100.
	if input.SampleRate < 0 || input.SampleRate > 100 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeValidation,
				"message": "sampleRate must be between 0 and 100",
			},
		})
	}

	// Validate bodyMaxBytes: 0 ≤ value ≤ 65536.
	if input.BodyMaxBytes < 0 || input.BodyMaxBytes > 65536 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeValidation,
				"message": "bodyMaxBytes must be between 0 and 65536",
			},
		})
	}

	// Validate maskedHeaders: max 32 items, each ≤ 64 chars.
	if len(input.MaskedHeaders) > 32 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeValidation,
				"message": "maskedHeaders must not exceed 32 items",
			},
		})
	}
	for _, h := range input.MaskedHeaders {
		if len(h) > 64 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    ErrCodeValidation,
					"message": "each maskedHeaders item must be 64 characters or fewer",
				},
			})
		}
	}

	// Validate maskedBodyFields: max 32 items, each ≤ 64 chars.
	if len(input.MaskedBodyFields) > 32 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeValidation,
				"message": "maskedBodyFields must not exceed 32 items",
			},
		})
	}
	for _, f := range input.MaskedBodyFields {
		if len(f) > 64 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    ErrCodeValidation,
					"message": "each maskedBodyFields item must be 64 characters or fewer",
				},
			})
		}
	}

	// Persist.
	if err := h.serviceRepo.UpdateApiCaptureConfig(serviceID, &input); err != nil {
		return internalError(c, ErrCodeUpdate, err)
	}

	// Return the saved config (re-read to confirm persisted values).
	saved, err := h.serviceRepo.GetApiCaptureConfig(serviceID)
	if err != nil {
		return internalError(c, ErrCodeFetch, err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    saved,
	})
}
