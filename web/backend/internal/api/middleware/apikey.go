package middleware

import (
	"log"
	"strings"
	"sync"

	"github.com/aiturn/everyup/internal/crypto"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
)

// apiKeyCache maps SHA-256 hash → *models.Service for fast API key lookups.
var apiKeyCache sync.Map

// WarmUpApiKeyCache loads all API key mappings from the database into memory.
// Call this once at server startup.
func WarmUpApiKeyCache(repo *database.ServiceRepository) error {
	mappings, err := repo.GetAllApiKeyMappings()
	if err != nil {
		return err
	}
	for hash, svc := range mappings {
		apiKeyCache.Store(hash, svc)
	}
	log.Printf("[ApiKeyCache] Warmed up %d API key(s)", len(mappings))
	return nil
}

// PutApiKeyCache adds or updates a cache entry.
func PutApiKeyCache(apiKeyHash string, service *models.Service) {
	apiKeyCache.Store(apiKeyHash, service)
}

// InvalidateApiKeyCache removes a cache entry by its hash.
func InvalidateApiKeyCache(apiKeyHash string) {
	apiKeyCache.Delete(apiKeyHash)
}

// ApiKeyAuth returns a middleware that validates API key from Authorization: Bearer
// or X-API-Key. X-API-Key is supported for API capture clients and older snippets.
// It checks the in-memory cache first; on a cache miss it falls back to a DB lookup.
func ApiKeyAuth() fiber.Handler {
	repo := database.NewServiceRepository()

	return func(c *fiber.Ctx) error {
		apiKey, ok := extractAPIKey(c)
		if !ok {
			return c.Status(401).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "UNAUTHORIZED",
					"message": "Missing API key",
				},
			})
		}

		if apiKey == "" {
			return c.Status(401).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "UNAUTHORIZED",
					"message": "Invalid API key format. Expected: Authorization: Bearer <api_key> or X-API-Key: <api_key>",
				},
			})
		}

		hash := crypto.HashApiKey(apiKey)

		// 1. Check in-memory cache
		if cached, ok := apiKeyCache.Load(hash); ok {
			service := cached.(*models.Service)
			if service.Type != models.ServiceTypeLog {
				return c.Status(403).JSON(fiber.Map{
					"success": false,
					"error": fiber.Map{
						"code":    "FORBIDDEN",
						"message": "API key is not allowed for log ingestion",
					},
				})
			}
			if !service.IsActive {
				return c.Status(403).JSON(fiber.Map{
					"success": false,
					"error": fiber.Map{
						"code":    "FORBIDDEN",
						"message": "Service is inactive",
					},
				})
			}
			c.Locals("service", service)
			return c.Next()
		}

		// 2. Cache miss — fall back to DB
		service, err := repo.GetByApiKeyHash(hash)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "INTERNAL_ERROR",
					"message": "Failed to validate API key",
				},
			})
		}

		if service == nil {
			return c.Status(401).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "UNAUTHORIZED",
					"message": "Invalid API key",
				},
			})
		}

		if service.Type != models.ServiceTypeLog {
			return c.Status(403).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "FORBIDDEN",
					"message": "API key is not allowed for log ingestion",
				},
			})
		}

		if !service.IsActive {
			return c.Status(403).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "FORBIDDEN",
					"message": "Service is inactive",
				},
			})
		}

		// Populate cache for next time
		apiKeyCache.Store(hash, service)

		c.Locals("service", service)
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
