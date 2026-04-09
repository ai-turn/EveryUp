package middleware

import (
	"log"
	"strings"
	"sync"

	"github.com/gofiber/fiber/v2"
	"github.com/aiturn/everyup/internal/crypto"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
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

// ApiKeyAuth returns a middleware that validates API key from Authorization header.
// It checks the in-memory cache first; on a cache miss it falls back to a DB lookup.
func ApiKeyAuth() fiber.Handler {
	repo := database.NewServiceRepository()

	return func(c *fiber.Ctx) error {
		auth := c.Get("Authorization")
		if auth == "" {
			return c.Status(401).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "UNAUTHORIZED",
					"message": "Missing Authorization header",
				},
			})
		}

		// Expect "Bearer <api_key>"
		parts := strings.SplitN(auth, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			return c.Status(401).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "UNAUTHORIZED",
					"message": "Invalid Authorization format. Expected: Bearer <api_key>",
				},
			})
		}

		apiKey := parts[1]
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
