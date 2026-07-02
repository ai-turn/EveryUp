package routes

import (
	"github.com/aiturn/everyup/internal/api/handlers"
	"github.com/aiturn/everyup/internal/api/middleware"
	"github.com/gofiber/fiber/v2"
)

// RegisterIngestRoutes registers API-key authenticated ingest endpoints.
func RegisterIngestRoutes(api fiber.Router) {
	logIngestMiddleware := []fiber.Handler{
		middleware.IngestRateLimiter(),
		middleware.OTLPAuth(),
	}
	otlpIngestHandler := handlers.NewOTLPIngestHandler()

	api.Post("/otlp/v1/logs", append(logIngestMiddleware, otlpBodyLimit(), otlpIngestHandler.IngestLogs)...)
	api.Post("/otlp/v1/traces", append(logIngestMiddleware, otlpBodyLimit(), otlpIngestHandler.IngestTraces)...)
	api.Post("/otlp/v1/metrics", append(logIngestMiddleware, otlpBodyLimit(), otlpIngestHandler.IngestMetrics)...)
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
