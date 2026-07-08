package handlers

import (
	"strconv"
	"time"

	"github.com/aiturn/everyup/internal/collector"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
)

// SystemHandler handles system resource monitoring requests.
type SystemHandler struct {
	manager    *collector.CollectorManager
	metricRepo *database.SystemMetricRepository
	hostRepo   *database.HostRepository
}

// NewSystemHandler creates a new system handler backed by a CollectorManager.
func NewSystemHandler(mgr *collector.CollectorManager) *SystemHandler {
	return &SystemHandler{
		manager:    mgr,
		metricRepo: database.NewSystemMetricRepository(),
		hostRepo:   database.NewHostRepository(),
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
// For the local host it reads from the in-process CollectorManager (live data).
// For any other host it reads the latest stored metric from the DB.
func (h *SystemHandler) GetInfo(c *fiber.Ctx) error {
	hostID := h.getHostID(c)

	if hostID == "local" {
		return h.getInfoFromCollector(c, hostID)
	}
	return h.getInfoFromDB(c, hostID)
}

func (h *SystemHandler) getInfoFromCollector(c *fiber.Ctx, hostID string) error {
	info := h.manager.GetLatestInfo(hostID)
	if info != nil {
		return c.JSON(fiber.Map{"success": true, "data": info})
	}
	coll := h.manager.GetCollector(hostID)
	if coll != nil {
		liveInfo, err := coll.GetSystemInfo()
		if err != nil {
			return internalError(c, "COLLECT_FAILED", err)
		}
		return c.JSON(fiber.Map{"success": true, "data": liveInfo})
	}
	return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
		"success": false,
		"error":   fiber.Map{"code": "NO_COLLECTOR", "message": "No active collector for this host."},
	})
}

func (h *SystemHandler) getInfoFromDB(c *fiber.Ctx, hostID string) error {
	metric, err := h.metricRepo.GetLatestByHost(hostID)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if metric == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "NO_DATA", "message": "No metric data yet for this host."},
		})
	}

	info := &models.SystemInfo{
		CPU: models.CPUInfo{Usage: metric.CPUUsage},
		Memory: models.MemInfo{
			Total: metric.MemTotal,
			Used:  metric.MemUsed,
			Usage: metric.MemUsage,
		},
		Disk: models.DiskInfo{
			Total:      metric.DiskTotal,
			Used:       metric.DiskUsed,
			Usage:      metric.DiskUsage,
			ReadSpeed:  metric.DiskRead,
			WriteSpeed: metric.DiskWrite,
		},
		Network: models.NetInfo{In: metric.NetIn, Out: metric.NetOut},
	}

	// Populate static fields from the host record if available.
	if host, _ := h.hostRepo.GetByID(hostID); host != nil {
		info.Hostname = host.Name
		info.IP = host.IP
	}

	return c.JSON(fiber.Map{"success": true, "data": info})
}

// GetMetricsHistory returns time-series data for chart rendering.
// Reads from the system_metrics DB table for all hosts (local and remote).
func (h *SystemHandler) GetMetricsHistory(c *fiber.Ctx) error {
	hostID := h.getHostID(c)
	rangeStr := c.Query("range", "6h")

	data, err := getHistoryFromDB(h.metricRepo, hostID, rangeStr)
	if err != nil {
		return internalError(c, "HISTORY_FETCH_FAILED", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": data})
}

// GetProcesses returns the top N processes.
// Only available for the local host; remote hosts return 503.
func (h *SystemHandler) GetProcesses(c *fiber.Ctx) error {
	hostID := h.getHostID(c)

	coll := h.manager.GetCollector(hostID)
	if coll == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "NO_COLLECTOR",
				"message": "Process list is only available for locally monitored hosts.",
			},
		})
	}

	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	sortBy := c.Query("sort", "cpu")

	processes, err := coll.GetProcesses(limit, sortBy)
	if err != nil {
		return internalError(c, "PROCESS_FETCH_FAILED", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": processes})
}

// getHistoryFromDB queries metrics history directly from DB for any host.
func getHistoryFromDB(repo *database.SystemMetricRepository, hostID, rangeStr string) (fiber.Map, error) {
	var duration   time.Duration
	var bucketMins int

	switch rangeStr {
	case "1h":
		duration   = 1 * time.Hour
		bucketMins = 2
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
