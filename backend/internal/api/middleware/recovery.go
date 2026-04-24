package middleware

import (
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

// Recovery returns recovery middleware configuration.
// Stack traces are only enabled outside production to avoid info leakage.
func Recovery() fiber.Handler {
	return recover.New(recover.Config{
		EnableStackTrace: os.Getenv("EVERYUP_SERVER_MODE") != "production",
	})
}
