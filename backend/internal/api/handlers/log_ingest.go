package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
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

// LogIngestHandler handles external log ingestion via API key
type LogIngestHandler struct {
	logRepo      *database.LogRepository
	ruleRepo     *database.AlertRuleRepository
	alertManager *alerter.Manager
}

// NewLogIngestHandler creates a new log ingest handler
func NewLogIngestHandler() *LogIngestHandler {
	return &LogIngestHandler{
		logRepo:      database.NewLogRepository(),
		ruleRepo:     database.NewAlertRuleRepository(),
		alertManager: alerter.NewManager(),
	}
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
	if logEntry.Level != models.LogLevelError && logEntry.Level != models.LogLevelWarn {
		return
	}

	rules, err := h.ruleRepo.GetEnabledLogRulesByServiceID(service.ID)
	if err != nil {
		log.Printf("Failed to get log alert rules for service %s: %v", service.ID, err)
		return
	}

	if len(rules) == 0 {
		go h.alertManager.DispatchLogAlert(
			service.ID,
			service.Name,
			string(logEntry.Level),
			logEntry.Message,
			metadata,
		)
		return
	}

	for _, rule := range rules {
		if logRuleMatches(rule, logEntry.Level) {
			go h.alertManager.DispatchLogAlertForRule(
				rule,
				service.ID,
				service.Name,
				string(logEntry.Level),
				logEntry.Message,
				metadata,
			)
		}
	}
}

func logRuleMatches(rule models.AlertRule, level models.LogLevel) bool {
	value := logLevelValue(level)
	threshold := rule.Threshold
	if threshold <= 0 {
		threshold = logLevelValue(models.LogLevelWarn)
	}
	return compareAlertValue(value, rule.Operator, threshold)
}

func logLevelValue(level models.LogLevel) float64 {
	switch level {
	case models.LogLevelError:
		return 4
	case models.LogLevelWarn:
		return 3
	case models.LogLevelInfo:
		return 2
	case models.LogLevelDebug:
		return 1
	case models.LogLevelTrace:
		return 0
	default:
		return 0
	}
}

func compareAlertValue(value float64, operator models.AlertOperator, threshold float64) bool {
	switch operator {
	case models.AlertOperatorGT:
		return value > threshold
	case models.AlertOperatorGTE:
		return value >= threshold
	case models.AlertOperatorLT:
		return value < threshold
	case models.AlertOperatorLTE:
		return value <= threshold
	case models.AlertOperatorEQ:
		return value == threshold
	default:
		return value >= threshold
	}
}
