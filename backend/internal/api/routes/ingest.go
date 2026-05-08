package routes

import (
	"github.com/aiturn/everyup/internal/api/handlers"
	"github.com/aiturn/everyup/internal/api/middleware"
	"github.com/gofiber/fiber/v2"
)

// RegisterIngestRoutes registers API-key authenticated ingest endpoints.
func RegisterIngestRoutes(api fiber.Router, logIngestHandler *handlers.LogIngestHandler, apiRequestIngestHandler *handlers.ApiRequestIngestHandler) {
	logIngestMiddleware := []fiber.Handler{
		middleware.IngestRateLimiter(),
		middleware.ApiKeyAuth(),
	}
	otlpIngestHandler := handlers.NewOTLPIngestHandler()

	// Legacy JSON log ingest endpoint. Kept for existing agents while new
	// integrations move to OTLP logs/traces under /otlp/v1/*.
	api.Post("/ingest/logs", append(logIngestMiddleware, legacyIngestDeprecation(), logIngestHandler.Ingest)...)

	// Legacy log ingest endpoint for deployed agents and existing snippets.
	api.Post("/logs/ingest", append(logIngestMiddleware, legacyIngestDeprecation(), logIngestHandler.Ingest)...)

	api.Post("/ingest/requests",
		middleware.ApiRequestIngestRateLimiter(),
		middleware.ApiKeyAuth(),
		legacyIngestDeprecation(),
		apiRequestBodyLimit(),
		apiRequestIngestHandler.Ingest,
	)

	api.Post("/otlp/v1/logs", append(logIngestMiddleware, otlpBodyLimit(), otlpIngestHandler.IngestLogs)...)
	api.Post("/otlp/v1/traces", append(logIngestMiddleware, otlpBodyLimit(), otlpIngestHandler.IngestTraces)...)
}

func legacyIngestDeprecation() fiber.Handler {
	return func(c *fiber.Ctx) error {
		c.Set("Deprecation", "true")
		c.Set("Link", `</api/v1/otlp/v1/logs>; rel="successor-version", </api/v1/otlp/v1/traces>; rel="successor-version"`)
		c.Set("Warning", `299 - "Legacy ingest is deprecated; use OpenTelemetry OTLP over /api/v1/otlp/v1/logs and /api/v1/otlp/v1/traces."`)
		return c.Next()
	}
}

func apiRequestBodyLimit() fiber.Handler {
	return func(c *fiber.Ctx) error {
		const maxBody = 1 * 1024 * 1024 // 1 MiB
		if len(c.Body()) > maxBody {
			return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    handlers.ErrCodeValidation,
					"message": "Request body exceeds 1 MiB limit",
				},
			})
		}
		return c.Next()
	}
}

func otlpBodyLimit() fiber.Handler {
	return func(c *fiber.Ctx) error {
		const maxBody = 4 * 1024 * 1024 // 4 MiB
		if len(c.Body()) > maxBody {
			return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    handlers.ErrCodeValidation,
					"message": "OTLP request body exceeds 4 MiB limit",
				},
			})
		}
		return c.Next()
	}
}
