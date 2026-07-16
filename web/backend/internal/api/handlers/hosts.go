package handlers

import (
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
)

// HostHandler handles host-related requests
type HostHandler struct {
	repo       *database.HostRepository
	metricRepo *database.SystemMetricRepository
}

// NewHostHandler creates a new host handler
func NewHostHandler() *HostHandler {
	return &HostHandler{
		repo:       database.NewHostRepository(),
		metricRepo: database.NewSystemMetricRepository(),
	}
}

// GetSummary returns production-ready infrastructure list data.
func (h *HostHandler) GetSummary(c *fiber.Ctx) error {
	hosts, err := h.repo.GetAll()
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	hostIDs := make([]string, 0, len(hosts))
	for _, host := range hosts {
		hostIDs = append(hostIDs, host.ID)
	}

	latestMetrics, err := h.metricRepo.GetLatestByHosts(hostIDs)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	netTrends, err := h.metricRepo.GetNetTrendByHosts(hostIDs, time.Now().Add(-30*time.Minute))
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	summaries := make([]models.InfraResourceSummary, 0, len(hosts))
	cutoff := time.Now().Add(-2 * time.Minute)
	for i := range hosts {
		summary := buildInfraResourceSummary(&hosts[i], latestMetrics[hosts[i].ID], netTrends[hosts[i].ID], cutoff)
		summaries = append(summaries, summary)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    summaries,
	})
}

// GetAll returns all hosts with computed status
func (h *HostHandler) GetAll(c *fiber.Ctx) error {
	hosts, err := h.repo.GetAll()
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	// Enrich with computed status based on recent metrics
	cutoff := time.Now().Add(-2 * time.Minute)
	for i := range hosts {
		if !hosts[i].IsActive {
			hosts[i].Status = models.HostStatusOffline
		} else if hosts[i].LastError != "" {
			hosts[i].Status = models.HostStatusError
		} else {
			latest, _ := h.metricRepo.GetLatestByHost(hosts[i].ID)
			if latest != nil && latest.CreatedAt.After(cutoff) {
				hosts[i].Status = models.HostStatusOnline
			} else {
				hosts[i].Status = models.HostStatusUnknown
			}
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    hosts,
	})
}

func buildInfraResourceSummary(host *models.Host, latest models.SystemMetric, netTrend []float64, cutoff time.Time) models.InfraResourceSummary {
	isRemote := host.Type == models.HostTypeRemote
	status := models.InfraStatusUnknown
	severity := models.InfraSeverityWarning
	reason := "metric_stale"
	var lastSeenAt *time.Time
	var lastCollectedAt *time.Time
	var incidentSince *time.Time
	var cpuUsage *float64
	var memoryUsage *float64
	var diskUsage *float64

	if latest.HostID != "" {
		lastSeenAt = &latest.CreatedAt
		lastCollectedAt = &latest.CreatedAt
		cpuUsage = &latest.CPUUsage
		memoryUsage = &latest.MemUsage
		diskUsage = &latest.DiskUsage
	}

	if !host.IsActive {
		status = models.InfraStatusPaused
		severity = models.InfraSeverityNone
		reason = "paused"
	} else if host.LastError != "" {
		status = models.InfraStatusError
		severity = models.InfraSeverityCritical
		reason = "collector_error"
		incidentSince = &host.UpdatedAt
	} else if latest.HostID == "" {
		status = models.InfraStatusUnknown
		severity = models.InfraSeverityWarning
		reason = "no_metrics"
		incidentSince = &host.CreatedAt
	} else if latest.CreatedAt.Before(cutoff) {
		status = models.InfraStatusWarning
		severity = models.InfraSeverityWarning
		reason = "metric_stale"
		incidentSince = &latest.CreatedAt
	} else {
		maxUsage := latest.CPUUsage
		if latest.MemUsage > maxUsage {
			maxUsage = latest.MemUsage
		}
		if latest.DiskUsage > maxUsage {
			maxUsage = latest.DiskUsage
		}

		switch {
		case maxUsage >= 90:
			status = models.InfraStatusCritical
			severity = models.InfraSeverityCritical
			reason = "threshold_exceeded"
			incidentSince = &latest.CreatedAt
		case maxUsage >= 80:
			status = models.InfraStatusWarning
			severity = models.InfraSeverityWarning
			reason = "threshold_exceeded"
			incidentSince = &latest.CreatedAt
		default:
			status = models.InfraStatusHealthy
			severity = models.InfraSeverityNone
			reason = "healthy"
		}
	}

	summary := models.InfraResourceSummary{
		ID:              host.ID,
		Name:            host.Name,
		Type:            host.ResourceCategory,
		ConnectionType:  host.Type,
		Status:          status,
		Severity:        severity,
		StatusReason:    reason,
		Cluster:         host.Group,
		IP:              host.IP,
		IsActive:        host.IsActive,
		IsRemote:        isRemote,
		LastSeenAt:      lastSeenAt,
		LastCollectedAt: lastCollectedAt,
		IncidentSince:   incidentSince,
		LastError:       host.LastError,
		CPUUsage:        cpuUsage,
		MemoryUsage:     memoryUsage,
		DiskUsage:       diskUsage,
		NetTrend:        netTrend,
		CreatedAt:       host.CreatedAt,
		UpdatedAt:       host.UpdatedAt,
	}

	return summary
}

// GetByID returns a host by ID
func (h *HostHandler) GetByID(c *fiber.Ctx) error {
	id := c.Params("hostId")

	host, err := h.repo.GetByID(id)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	if host == nil {
		return c.Status(404).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "HOST_NOT_FOUND",
				"message": "Host not found",
			},
		})
	}

	// Compute status
	cutoff := time.Now().Add(-2 * time.Minute)
	if !host.IsActive {
		host.Status = models.HostStatusOffline
	} else if host.LastError != "" {
		host.Status = models.HostStatusError
	} else {
		latest, _ := h.metricRepo.GetLatestByHost(host.ID)
		if latest != nil && latest.CreatedAt.After(cutoff) {
			host.Status = models.HostStatusOnline
		} else {
			host.Status = models.HostStatusUnknown
		}
	}
	return c.JSON(fiber.Map{
		"success": true,
		"data":    host,
	})
}
