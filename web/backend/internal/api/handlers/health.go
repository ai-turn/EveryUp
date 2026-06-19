package handlers

import (
	"runtime"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/aiturn/everyup/internal/database"
)

var (
	// Version is set at build time
	Version   = "1.0.0"
	startTime = time.Now()
)

// HealthHandler handles health check requests
type HealthHandler struct {
	serviceRepo *database.ServiceRepository
}

// NewHealthHandler creates a new health handler
func NewHealthHandler() *HealthHandler {
	return &HealthHandler{
		serviceRepo: database.NewServiceRepository(),
	}
}

// Health returns API server health status
func (h *HealthHandler) Health(c *fiber.Ctx) error {
	// Check database connection
	dbStatus := "connected"
	if err := database.DB.Ping(); err != nil {
		dbStatus = "disconnected"
	}

	// Get active services count
	services, _ := h.serviceRepo.GetAll()
	activeServices := len(services)

	// Calculate uptime
	uptime := time.Since(startTime)
	uptimeStr := formatDuration(uptime)

	// Get memory stats
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"status":         "healthy",
			"version":        Version,
			"uptime":         uptimeStr,
			"database":       dbStatus,
			"activeServices": activeServices,
			"memory": fiber.Map{
				"alloc":      formatBytes(memStats.Alloc),
				"totalAlloc": formatBytes(memStats.TotalAlloc),
				"sys":        formatBytes(memStats.Sys),
			},
			"go": fiber.Map{
				"version":    runtime.Version(),
				"goroutines": runtime.NumGoroutine(),
			},
		},
	})
}

// Version returns version info
func (h *HealthHandler) Version(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"version":   Version,
		"goVersion": runtime.Version(),
		"os":        runtime.GOOS,
		"arch":      runtime.GOARCH,
	})
}

// formatDuration formats duration to human readable string
func formatDuration(d time.Duration) string {
	days := int(d.Hours()) / 24
	hours := int(d.Hours()) % 24
	minutes := int(d.Minutes()) % 60

	if days > 0 {
		return formatDurationParts(days, "d", hours, "h", minutes, "m")
	}
	if hours > 0 {
		return formatDurationParts(hours, "h", minutes, "m", 0, "")
	}
	return formatDurationParts(minutes, "m", 0, "", 0, "")
}

func formatDurationParts(v1 int, s1 string, v2 int, s2 string, v3 int, s3 string) string {
	result := ""
	if v1 > 0 {
		result += formatInt(v1) + s1
	}
	if v2 > 0 {
		if result != "" {
			result += " "
		}
		result += formatInt(v2) + s2
	}
	if v3 > 0 {
		if result != "" {
			result += " "
		}
		result += formatInt(v3) + s3
	}
	if result == "" {
		return "0m"
	}
	return result
}

func formatInt(n int) string {
	return string(rune('0'+n/10)) + string(rune('0'+n%10))
}

// formatBytes formats bytes to human readable string
func formatBytes(b uint64) string {
	const unit = 1024
	if b < unit {
		return formatBytesWithUnit(b, "B")
	}
	div, exp := uint64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	units := []string{"KB", "MB", "GB", "TB"}
	return formatBytesWithUnit(b/div, units[exp])
}

func formatBytesWithUnit(b uint64, unit string) string {
	// Simple integer formatting
	s := ""
	for b > 0 {
		s = string(rune('0'+b%10)) + s
		b /= 10
	}
	if s == "" {
		s = "0"
	}
	return s + " " + unit
}
