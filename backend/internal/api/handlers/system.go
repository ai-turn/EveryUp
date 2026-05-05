package handlers

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/aiturn/everyup/internal/collector"
	"github.com/aiturn/everyup/internal/database"
)

// SystemHandler handles system resource monitoring requests.
type SystemHandler struct {
	manager    *collector.CollectorManager
	metricRepo *database.SystemMetricRepository
}

// NewSystemHandler creates a new system handler backed by a CollectorManager.
func NewSystemHandler(mgr *collector.CollectorManager) *SystemHandler {
	return &SystemHandler{
		manager:    mgr,
		metricRepo: database.NewSystemMetricRepository(),
	}
}

// getHostID extracts the hostId from route params, falling back to "local".
func (h *SystemHandler) getHostID(c *fiber.Ctx) string {
	hostID := c.Params("hostId")
	if hostID == "" {
		return "local"
	}
	return hostID
}

// GetInfo returns host system information with current resource snapshot.
func (h *SystemHandler) GetInfo(c *fiber.Ctx) error {
	hostID := h.getHostID(c)

	// Try cached info from the manager first
	info := h.manager.GetLatestInfo(hostID)
	if info != nil {
		return c.JSON(fiber.Map{
			"success": true,
			"data":    info,
		})
	}

	// If there's a registered collector, call it directly
	coll := h.manager.GetCollector(hostID)
	if coll != nil {
		liveInfo, err := coll.GetSystemInfo()
		if err != nil {
			return internalError(c, "COLLECT_FAILED", err)
		}
		return c.JSON(fiber.Map{
			"success": true,
			"data":    liveInfo,
		})
	}

	// No collector registered for this host
	return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
		"success": false,
		"error": fiber.Map{
			"code":    "NO_COLLECTOR",
			"message": "No active collector for this host. The host may be offline or not yet configured.",
		},
	})
}

// GetMetricsHistory returns time-series data for chart rendering.
func (h *SystemHandler) GetMetricsHistory(c *fiber.Ctx) error {
	hostID := h.getHostID(c)
	rangeStr := c.Query("range", "6h")

	history, err := h.manager.GetHistory(hostID, rangeStr)
	if err != nil {
		return internalError(c, "HISTORY_FETCH_FAILED", err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    history,
	})
}

// GetProcesses returns the top N processes.
func (h *SystemHandler) GetProcesses(c *fiber.Ctx) error {
	hostID := h.getHostID(c)

	coll := h.manager.GetCollector(hostID)
	if coll == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "NO_COLLECTOR",
				"message": "No active collector for this host.",
			},
		})
	}

	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	sortBy := c.Query("sort", "cpu")

	processes, err := coll.GetProcesses(limit, sortBy)
	if err != nil {
		return internalError(c, "PROCESS_FETCH_FAILED", err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    processes,
	})
}

// getHistoryFromDB queries metrics history directly from DB for any host.
func getHistoryFromDB(repo *database.SystemMetricRepository, hostID, rangeStr string) (fiber.Map, error) {
	var duration   time.Duration
	var bucketMins int

	switch rangeStr {
	case "12h":
		duration   = 12 * time.Hour
		bucketMins = 10
	case "24h":
		duration   = 24 * time.Hour
		bucketMins = 20
	default:
		duration   = 6 * time.Hour
		bucketMins = 5
		rangeStr   = "6h"
	}

	since := time.Now().Add(-duration)
	points, err := repo.GetHistory(hostID, since, bucketMins)
	if err != nil {
		return nil, err
	}

	return fiber.Map{
		"range":  rangeStr,
		"points": points,
	}, nil
}
