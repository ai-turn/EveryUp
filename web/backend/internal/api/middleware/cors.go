package middleware

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

// CORS returns CORS middleware configuration.
// allowOrigins: comma-separated list of allowed origins (e.g. "https://app.example.com").
//
// Behavior:
//   - Empty string → same-origin only (no CORS headers added). Safe default for
//     embedded frontend served from the same origin (Docker single-container).
//   - Explicit "*" in production → rejected (log.Fatalf) to prevent cross-origin abuse.
//   - Explicit "*" in development → allowed for convenience.
//   - Specific origins → used as-is with credentials support.
func CORS(allowOrigins string, mode string) fiber.Handler {
	// No origins configured → same-origin only; skip CORS middleware entirely.
	if allowOrigins == "" {
		return func(c *fiber.Ctx) error { return c.Next() }
	}

	if allowOrigins == "*" && mode == "production" {
		log.Fatalf("[SECURITY] CORS wildcard '*' is not allowed in production mode. " +
			"Set EVERYUP_SERVER_ALLOWORIGINS to your frontend domain (e.g. https://app.example.com).")
	}

	// AllowCredentials requires a specific origin (not wildcard).
	// httpOnly cookies won't be sent cross-origin unless this is true + origin is explicit.
	allowCredentials := allowOrigins != "*"
	return cors.New(cors.Config{
		AllowOrigins:     allowOrigins,
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS,PATCH",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization,X-API-Key,X-Requested-With",
		AllowCredentials: allowCredentials,
		ExposeHeaders:    "Content-Length,Content-Type",
		MaxAge:           86400, // 24 hours
	})
}
