package handlers

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/oklog/ulid/v2"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

const maxApiRequestBatchSize = 50

// ApiRequestIngestHandler handles API request capture ingestion via API key.
type ApiRequestIngestHandler struct {
	repo        *database.ApiRequestRepository
	serviceRepo *database.ServiceRepository
}

// NewApiRequestIngestHandler creates a new ApiRequestIngestHandler.
func NewApiRequestIngestHandler() *ApiRequestIngestHandler {
	return &ApiRequestIngestHandler{
		repo:        database.NewApiRequestRepository(),
		serviceRepo: database.NewServiceRepository(),
	}
}

// Ingest handles POST /api/v1/ingest/requests.
// Accepts a single ApiRequestIngestEntry or a batch via {"requests":[...]}.
func (h *ApiRequestIngestHandler) Ingest(c *fiber.Ctx) error {
	service, ok := c.Locals("service").(*models.Service)
	if !ok || service == nil {
		return c.Status(401).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "UNAUTHORIZED",
				"message": "Service not found in context",
			},
		})
	}

	// Parse body
	var payload models.ApiRequestIngestRequest
	if err := json.Unmarshal(c.Body(), &payload); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeInvalidRequest,
				"message": "Invalid request body: " + err.Error(),
			},
		})
	}

	// Determine entries: batch or single
	var entries []models.ApiRequestIngestEntry
	if len(payload.Requests) > 0 {
		entries = payload.Requests
	} else {
		// Single entry — use the embedded fields
		entries = []models.ApiRequestIngestEntry{payload.ApiRequestIngestEntry}
	}

	// Enforce batch limit before any processing
	if len(entries) > maxApiRequestBatchSize {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeValidation,
				"message": fmt.Sprintf("batch size exceeds maximum of %d requests", maxApiRequestBatchSize),
			},
		})
	}

	// Load capture config for service
	cfg, err := h.serviceRepo.GetApiCaptureConfig(service.ID)
	if err != nil {
		log.Printf("[ApiRequestIngest] Failed to load capture config for service %s: %v", service.ID, err)
		return internalError(c, ErrCodeDatabase, err)
	}

	processed := 0
	filtered := 0
	errs := 0
	var batch []models.ApiRequest

	for i, entry := range entries {
		// Validate entry
		if err := validateApiRequestEntry(&entry); err != nil {
			log.Printf("[ApiRequestIngest] Entry #%d validation failed: %v", i, err)
			errs++
			continue
		}

		isError := entry.StatusCode >= 500 || entry.Error != ""

		if !shouldCapture(cfg, entry.StatusCode, entry.Error, cryptoRandFloat64) {
			filtered++
			continue
		}

		// Normalize path
		pathTemplate := NormalizePath(entry.Path)

		// Mask and marshal request headers
		maskedReqHeaders := MaskHeaders(entry.ReqHeaders, cfg.MaskedHeaders)
		var reqHeadersJSON json.RawMessage
		if maskedReqHeaders != nil {
			if data, err := json.Marshal(maskedReqHeaders); err == nil {
				reqHeadersJSON = data
			}
		}

		// Mask and marshal response headers
		maskedResHeaders := MaskHeaders(entry.ResHeaders, cfg.MaskedHeaders)
		var resHeadersJSON json.RawMessage
		if maskedResHeaders != nil {
			if data, err := json.Marshal(maskedResHeaders); err == nil {
				resHeadersJSON = data
			}
		}

		// Mask body fields
		maskedReqBody := MaskJSONBody(entry.ReqBody, cfg.MaskedBodyFields)
		maskedResBody := MaskJSONBody(entry.ResBody, cfg.MaskedBodyFields)

		// Truncate bodies
		truncatedReqBody, reqBodySize := TruncateBody(maskedReqBody, cfg.BodyMaxBytes)
		truncatedResBody, resBodySize := TruncateBody(maskedResBody, cfg.BodyMaxBytes)

		// Determine request ID
		requestID := entry.RequestID
		if requestID == "" {
			requestID = newULID()
		}

		// Determine timestamp
		var createdAt time.Time
		if entry.Timestamp != nil {
			createdAt = *entry.Timestamp
		} else {
			createdAt = time.Now()
		}

		batch = append(batch, models.ApiRequest{
			ServiceID:    service.ID,
			RequestID:    requestID,
			Method:       strings.ToUpper(entry.Method),
			Path:         entry.Path,
			PathTemplate: pathTemplate,
			StatusCode:   entry.StatusCode,
			DurationMs:   entry.DurationMs,
			ClientIP:     entry.ClientIP,
			ReqHeaders:   reqHeadersJSON,
			ReqBody:      truncatedReqBody,
			ReqBodySize:  reqBodySize,
			ResHeaders:   resHeadersJSON,
			ResBody:      truncatedResBody,
			ResBodySize:  resBodySize,
			Error:        entry.Error,
			IsError:      isError,
			CreatedAt:    createdAt,
		})
	}

	if len(batch) > 0 {
		if _, err := h.repo.CreateBatch(batch); err != nil {
			log.Printf("[ApiRequestIngest] CreateBatch failed for service %s: %v", service.ID, err)
			return internalError(c, ErrCodeDatabase, err)
		}
		processed = len(batch)
	}

	return c.Status(201).JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"processed": processed,
			"filtered":  filtered,
			"errors":    errs,
			"total":     len(entries),
		},
	})
}

// validateApiRequestEntry checks required fields and size constraints.
func validateApiRequestEntry(e *models.ApiRequestIngestEntry) error {
	if e.Method == "" {
		return fmt.Errorf("method is required")
	}
	if len(e.Method) > 10 {
		return fmt.Errorf("method exceeds 10 characters")
	}
	if e.Path == "" {
		return fmt.Errorf("path is required")
	}
	if len(e.Path) > 2048 {
		return fmt.Errorf("path exceeds 2048 characters")
	}
	if e.StatusCode < 100 || e.StatusCode > 599 {
		return fmt.Errorf("statusCode must be between 100 and 599, got %d", e.StatusCode)
	}
	if e.DurationMs < 0 {
		return fmt.Errorf("durationMs must be >= 0")
	}
	return nil
}

// newULID generates a new ULID string using crypto/rand.
func newULID() string {
	return ulid.MustNew(ulid.Timestamp(time.Now()), rand.Reader).String()
}
