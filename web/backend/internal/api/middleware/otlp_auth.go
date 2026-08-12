package middleware

import (
	"errors"
	"strings"

	"github.com/aiturn/everyup/internal/crypto"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/directtelemetry"
	"github.com/aiturn/everyup/internal/infrastructure"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
)

// IngestPrincipal identifies the sender of an OTLP payload. A request is
// authenticated by a single project key, which resolves to EITHER a connected
// agent (the unified path — one key for health, infra, logs and traces) or a
// legacy log-only service created before the agent-only architecture.
type IngestPrincipal struct {
	AgentID                  string            // non-empty for connected-agent (project) keys
	ServiceID                string            // non-empty for legacy log-service keys
	Name                     string            // fallback service name (agent or service name)
	Direct                   bool              // true when one credential is bound to one Observed Service
	InfrastructureResourceID string            // standard OTel Collector hostmetrics target
	ApiExcludePaths          []string          // direct and legacy services
	LogLevelFilter           []models.LogLevel // legacy services only; agents filter per-service at ingest
}

// ResolveServiceName prevents a direct credential from creating additional
// targets through a payload-controlled service.name. Agent and legacy keys keep
// their historical multi-service/fallback behaviour.
func (p *IngestPrincipal) ResolveServiceName(resourceName string) string {
	if p.Direct || resourceName == "" {
		return p.Name
	}
	return resourceName
}

// OTLPAuth authenticates OTLP ingest with the project API key. It accepts the
// connected-agent key (agents table, evup_svc_) first — the primary path — and
// falls back to a legacy log-service key (services table, everyup_) so existing
// deployments keep working. The resolved IngestPrincipal is stored in Locals.
func OTLPAuth(signal models.TelemetrySignal) fiber.Handler {
	agentRepo := database.NewAgentRepository()
	serviceRepo := database.NewServiceRepository()
	directManager := directtelemetry.NewManager()
	infrastructureManager := infrastructure.NewManager()

	return func(c *fiber.Ctx) error {
		apiKey, ok := extractAPIKey(c)
		if !ok || apiKey == "" {
			return otlpAuthError(c, 401, "UNAUTHORIZED",
				"Missing API key. Expected: Authorization: Bearer <api_key> or X-API-Key: <api_key>")
		}

		hash := crypto.HashApiKey(apiKey)

		// 1. Connected-agent (project) key — the unified path.
		// ponytail: per-request DB lookup; agents are few and api_key_hash is uniquely
		// indexed. Add a cache like apiKeyCache if OTLP volume ever makes this hot.
		agent, found, err := agentRepo.FindAgentByKeyHash(hash)
		if err != nil {
			return otlpAuthError(c, 500, "INTERNAL_ERROR", "Failed to validate API key")
		}
		if found {
			c.Locals("ingestPrincipal", &IngestPrincipal{
				AgentID: agent.ID,
				Name:    agent.Name,
			})
			return c.Next()
		}

		// 2. Direct Observed Service key with per-signal authorization.
		directService, err := directManager.AuthorizeHash(hash, signal)
		if err != nil {
			switch {
			case errors.Is(err, directtelemetry.ErrInactive):
				return otlpAuthError(c, 403, "FORBIDDEN", "Direct telemetry connection is inactive")
			case errors.Is(err, directtelemetry.ErrSignalDenied):
				return otlpAuthError(c, 403, "FORBIDDEN", "API key is not allowed for this telemetry signal")
			default:
				return otlpAuthError(c, 500, "INTERNAL_ERROR", "Failed to validate API key")
			}
		}
		if directService != nil {
			c.Locals("ingestPrincipal", &IngestPrincipal{
				ServiceID:       directService.ID,
				Name:            directService.Name,
				Direct:          true,
				ApiExcludePaths: directService.ApiExcludePaths,
				LogLevelFilter:  directService.LogLevelFilter,
			})
			return c.Next()
		}

		// 3. Standard OpenTelemetry Collector hostmetrics credential. It is
		// deliberately metrics-only and projects into the shared infrastructure
		// resource history instead of the application metrics store.
		infrastructureResource, err := infrastructureManager.AuthorizeHash(hash, signal)
		if err != nil {
			switch {
			case errors.Is(err, infrastructure.ErrInactive):
				return otlpAuthError(c, 403, "FORBIDDEN", "Infrastructure collector connection is inactive")
			case errors.Is(err, infrastructure.ErrSignalDenied):
				return otlpAuthError(c, 403, "FORBIDDEN", "Infrastructure collector key only accepts metrics")
			default:
				return otlpAuthError(c, 500, "INTERNAL_ERROR", "Failed to validate API key")
			}
		}
		if infrastructureResource != nil {
			c.Locals("ingestPrincipal", &IngestPrincipal{
				InfrastructureResourceID: infrastructureResource.ID,
				Name:                     infrastructureResource.Name,
			})
			return c.Next()
		}

		// 4. Legacy log-service key.
		service, err := serviceRepo.GetByApiKeyHash(hash)
		if err != nil {
			return otlpAuthError(c, 500, "INTERNAL_ERROR", "Failed to validate API key")
		}
		if service == nil {
			return otlpAuthError(c, 401, "UNAUTHORIZED", "Invalid API key")
		}
		if service.Type != models.ServiceTypeLog {
			return otlpAuthError(c, 403, "FORBIDDEN", "API key is not allowed for telemetry ingestion")
		}
		if !service.IsActive {
			return otlpAuthError(c, 403, "FORBIDDEN", "Service is inactive")
		}

		c.Locals("ingestPrincipal", &IngestPrincipal{
			ServiceID:       service.ID,
			Name:            service.Name,
			ApiExcludePaths: service.ApiExcludePaths,
			LogLevelFilter:  service.LogLevelFilter,
		})
		return c.Next()
	}
}

func extractAPIKey(c *fiber.Ctx) (string, bool) {
	if auth := c.Get("Authorization"); auth != "" {
		parts := strings.SplitN(auth, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			return "", true
		}
		return strings.TrimSpace(parts[1]), true
	}
	if apiKey := strings.TrimSpace(c.Get("X-API-Key")); apiKey != "" {
		return apiKey, true
	}
	return "", false
}

func otlpAuthError(c *fiber.Ctx, status int, code, message string) error {
	return c.Status(status).JSON(fiber.Map{
		"success": false,
		"error":   fiber.Map{"code": code, "message": message},
	})
}
