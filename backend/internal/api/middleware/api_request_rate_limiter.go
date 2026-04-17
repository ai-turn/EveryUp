package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
)

// ApiRequestIngestRateLimiter returns a dedicated rate limiter for the API request ingest endpoint.
// Uses a separate in-memory store from IngestRateLimiter and AuthRateLimiter.
// Limits to 100 requests per second per API key (or IP as fallback).
func ApiRequestIngestRateLimiter() fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        100,
		Expiration: 1 * time.Second,
		KeyGenerator: func(c *fiber.Ctx) string {
			if auth := c.Get("Authorization"); auth != "" {
				return "apireq:" + auth
			}
			return "apireq:ip:" + c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "RATE_LIMIT_EXCEEDED",
					"message": "Rate limit exceeded",
				},
			})
		},
	})
}
