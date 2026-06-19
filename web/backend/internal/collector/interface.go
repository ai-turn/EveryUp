package collector

import "github.com/aiturn/everyup/internal/models"

// MetricCollector is the common interface for all metric collection backends.
// LocalCollector implements it using gopsutil, SSHCollector will implement it
// using SSH + /proc parsing.
type MetricCollector interface {
	// Collect gathers a single snapshot of system metrics.
	// Delta-based metrics (CPU %, disk I/O, network I/O) are calculated
	// internally against the previous snapshot.
	Collect() (*models.SystemMetric, error)

	// GetSystemInfo returns static host information combined with the
	// current resource snapshot (CPU, memory, disk).
	GetSystemInfo() (*models.SystemInfo, error)

	// GetProcesses returns the top N processes sorted by the given field.
	GetProcesses(limit int, sortBy string) ([]models.ProcessInfo, error)

	// HostID returns the host identifier this collector is associated with.
	HostID() string

	// Close releases any resources held by the collector (e.g. SSH connections).
	Close() error
}
