package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/aiturn/everyup/internal/crypto"
)

// JWTAuth validates the JWT from the Authorization header or httpOnly cookie.
// Priority: Authorization: Bearer <token> header > jwt_token cookie.
// On success, stores parsed claims in c.Locals("claims").
func JWTAuth() fiber.Handler {
	return func(c *fiber.Ctx) error {
		var tokenStr string

		// Priority 1: Authorization header
		auth := c.Get("Authorization")
		if strings.HasPrefix(auth, "Bearer ") {
			tokenStr = auth[7:]
		}

		// Priority 2: httpOnly cookie
		if tokenStr == "" {
			tokenStr = c.Cookies("jwt_token")
		}

		if tokenStr == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "UNAUTHORIZED",
					"message": "Missing or invalid authorization token",
				},
			})
		}

		claims, err := crypto.VerifyToken(tokenStr)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "UNAUTHORIZED",
					"message": "Token is expired or invalid",
				},
			})
		}

		c.Locals("claims", claims) // *crypto.UserClaims
		return c.Next()
	}
}
