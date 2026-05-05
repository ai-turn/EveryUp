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

	// Canonical log ingest endpoint. Keep ingest routes under /ingest/* so
	// API-key middleware cannot accidentally cover JWT-protected /logs routes.
	api.Post("/ingest/logs", append(logIngestMiddleware, logIngestHandler.Ingest)...)

	// Legacy log ingest endpoint for deployed agents and existing snippets.
	api.Post("/logs/ingest", append(logIngestMiddleware, logIngestHandler.Ingest)...)

	api.Post("/ingest/requests",
		middleware.ApiRequestIngestRateLimiter(),
		middleware.ApiKeyAuth(),
		apiRequestBodyLimit(),
		apiRequestIngestHandler.Ingest,
	)
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
