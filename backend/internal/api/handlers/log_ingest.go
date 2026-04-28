package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/alerter"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
)

// errLogFiltered is returned by processEntry when the log level is filtered out by the service config.
var errLogFiltered = errors.New("log level filtered")

const maxMessageBytes = 10 * 1024  // 10 KB
const maxMetadataBytes = 50 * 1024 // 50 KB
const maxBatchSize = 100

// LogIngestHandler handles external log ingestion via API key
type LogIngestHandler struct {
	logRepo      *database.LogRepository
	alertManager *alerter.Manager
}

// NewLogIngestHandler creates a new log ingest handler
func NewLogIngestHandler() *LogIngestHandler {
	return &LogIngestHandler{
		logRepo:      database.NewLogRepository(),
		alertManager: alerter.NewManager(),
	}
}

// Ingest receives logs from external services authenticated by API key.
// Auto-detects format from various logging libraries:
//   - MT native:    { "level":"error", "message":"..." } or { "logs":[...] }
//   - Winston:      { "level":"error", "message":"...", "timestamp":"..." }
//   - Serilog:      { "events":[{ "@t":"...", "@mt":"...", "@l":"Error" }] }
//   - Logstash:     { "@timestamp":"...", "level":"ERROR", "message":"..." }
//   - Python dict:  { "levelname":"ERROR", "msg":"..." }
//   - Form-encoded: levelname=ERROR&msg=... (Python HTTPHandler)
func (h *LogIngestHandler) Ingest(c *fiber.Ctx) error {
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

	contentType := strings.ToLower(c.Get("Content-Type"))
	body := c.Body()

	var entries []models.LogIngestEntry

	if strings.Contains(contentType, "application/x-www-form-urlencoded") {
		// Python HTTPHandler sends form-encoded data
		entry, err := normalizeFormEncoded(string(body))
		if err != nil {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "INVALID_REQUEST",
					"message": "Failed to parse form data: " + err.Error(),
				},
			})
		}
		entries = []models.LogIngestEntry{entry}
	} else {
		// JSON body — auto-detect format
		var err error
		entries, err = normalizeRawLogs(body)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "INVALID_REQUEST",
					"message": "Invalid request body: " + err.Error(),
				},
			})
		}
	}

	if len(entries) == 0 {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "VALIDATION_ERROR",
				"message": "No log entries found in request body",
			},
		})
	}

	if len(entries) > maxBatchSize {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "VALIDATION_ERROR",
				"message": fmt.Sprintf("batch size exceeds maximum of %d logs", maxBatchSize),
			},
		})
	}

	// Determine source from X-MT-Source header
	source := models.LogSourceExternal
	if c.Get("X-MT-Source") == "agent" {
		source = models.LogSourceAgent
	}

	// Single log — return single response
	if len(entries) == 1 {
		logEntry, err := h.processEntry(service, &entries[0], source)
		if errors.Is(err, errLogFiltered) {
			// Level filtered out — acknowledge silently so agents don't retry
			return c.Status(200).JSON(fiber.Map{
				"success": true,
				"data":    fiber.Map{"filtered": true},
			})
		}
		if err != nil {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "VALIDATION_ERROR",
					"message": err.Error(),
				},
			})
		}

		if err := h.logRepo.Create(logEntry); err != nil {
			log.Printf("Failed to create log entry: %v", err)
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "DATABASE_ERROR",
					"message": "Failed to store log entry",
				},
			})
		}

		h.triggerAlertIfNeeded(service, logEntry, entries[0].Metadata)

		return c.Status(201).JSON(fiber.Map{
			"success": true,
			"data": fiber.Map{
				"id":          logEntry.ID,
				"fingerprint": logEntry.Fingerprint,
			},
		})
	}

	// Batch — process all entries
	return h.ingestBatch(c, service, entries, source)
}

// ingestBatch processes a batch of log entries
func (h *LogIngestHandler) ingestBatch(c *fiber.Ctx, service *models.Service, logs []models.LogIngestEntry, source string) error {
	processed := 0
	filtered := 0
	errs := 0

	for i := range logs {
		logEntry, err := h.processEntry(service, &logs[i], source)
		if errors.Is(err, errLogFiltered) {
			filtered++
			continue
		}
		if err != nil {
			log.Printf("Batch log #%d validation failed: %v", i, err)
			errs++
			continue
		}

		if err := h.logRepo.Create(logEntry); err != nil {
			log.Printf("Batch log #%d DB failed: %v", i, err)
			errs++
			continue
		}

		h.triggerAlertIfNeeded(service, logEntry, logs[i].Metadata)
		processed++
	}

	return c.Status(201).JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"processed": processed,
			"filtered":  filtered,
			"errors":    errs,
			"total":     len(logs),
		},
	})
}

// processEntry validates and converts a single log entry
func (h *LogIngestHandler) processEntry(service *models.Service, entry *models.LogIngestEntry, source string) (*models.Log, error) {
	if entry.Message == "" {
		return nil, fmt.Errorf("message is required")
	}

	if len(entry.Message) > maxMessageBytes {
		return nil, fmt.Errorf("message exceeds maximum size of 10 KB")
	}

	// Default to info when no level is specified. Unknown/plain text logs should
	// not become alerts unless the sender explicitly marks them as warn/error.
	if entry.Level == "" {
		entry.Level = models.LogLevelInfo
	}

	// Apply per-service log level filter. Empty filter = accept all levels.
	if len(service.LogLevelFilter) > 0 {
		allowed := make(map[models.LogLevel]bool, len(service.LogLevelFilter))
		for _, l := range service.LogLevelFilter {
			allowed[l] = true
		}
		if !allowed[entry.Level] {
			return nil, errLogFiltered
		}
	}

	// Generate fingerprint
	fingerprint := alerter.GenerateFingerprint(service.ID, string(entry.Level), entry.Message)

	// Marshal metadata
	var metadataJSON json.RawMessage
	if entry.Metadata != nil {
		data, err := json.Marshal(entry.Metadata)
		if err != nil {
			return nil, fmt.Errorf("invalid metadata format")
		}
		if len(data) > maxMetadataBytes {
			return nil, fmt.Errorf("metadata exceeds maximum size of 50 KB")
		}
		metadataJSON = data
	}

	return &models.Log{
		ServiceID:   service.ID,
		Level:       entry.Level,
		Message:     entry.Message,
		Metadata:    metadataJSON,
		Source:      source,
		Fingerprint: fingerprint,
		CreatedAt:   time.Now(),
	}, nil
}

// triggerAlertIfNeeded dispatches alert for error/warn level logs
func (h *LogIngestHandler) triggerAlertIfNeeded(service *models.Service, logEntry *models.Log, metadata map[string]interface{}) {
	if logEntry.Level == models.LogLevelError || logEntry.Level == models.LogLevelWarn {
		go h.alertManager.DispatchLogAlert(
			service.ID,
			service.Name,
			string(logEntry.Level),
			logEntry.Message,
			metadata,
		)
	}
}
