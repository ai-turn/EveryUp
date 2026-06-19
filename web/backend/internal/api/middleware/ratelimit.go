package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
)

// AuthRateLimiter returns a rate limiter for authentication endpoints.
// Limits to maxAttempts requests per window per IP address to prevent brute force attacks.
func AuthRateLimiter() fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        5,
		Expiration: 15 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "RATE_LIMITED",
					"message": "Too many attempts. Please try again later.",
				},
			})
		},
	})
}

// IngestRateLimiter returns a rate limiter for log/metric ingestion endpoints.
// Limits to maxRequests per window per API key (via IP fallback).
func IngestRateLimiter() fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        600,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			// Use API key header if present, otherwise IP
			if auth := c.Get("Authorization"); auth != "" {
				return "apikey:" + auth
			}
			if apiKey := c.Get("X-API-Key"); apiKey != "" {
				return "apikey:" + apiKey
			}
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "RATE_LIMITED",
					"message": "Rate limit exceeded. Please slow down.",
				},
			})
		},
	})
}
