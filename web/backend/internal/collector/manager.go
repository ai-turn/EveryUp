package collector

import (
	"log"
	"math"
	"sync"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// CollectorManager schedules periodic collection and storage for the single
// local collector. SSH hosts were removed (migrateV33), so there is exactly
// one collector per process.
type CollectorManager struct {
	collector         *LocalCollector
	snapshots         []models.SystemMetric
	latest            *models.SystemInfo
	broadcast         func(interface{})
	onMetricCollected func(hostID, hostName string, metric *models.SystemMetric)
	repo              *database.SystemMetricRepository
	mu                sync.RWMutex

	collectInterval time.Duration
	storeInterval   time.Duration
	collectTicker   *time.Ticker
	storeTicker     *time.Ticker
	stopCh          chan struct{}
}

// NewCollectorManager creates a new CollectorManager.
func NewCollectorManager(collectInterval, storeInterval int) *CollectorManager {
	if collectInterval <= 0 {
		collectInterval = 5
	}
	if storeInterval <= 0 {
		storeInterval = 60
	}

	return &CollectorManager{
		repo:            database.NewSystemMetricRepository(),
		collectInterval: time.Duration(collectInterval) * time.Second,
		storeInterval:   time.Duration(storeInterval) * time.Second,
		stopCh:          make(chan struct{}),
	}
}

// SetBroadcast sets the WebSocket broadcast function.
func (m *CollectorManager) SetBroadcast(fn func(interface{})) {
	m.broadcast = fn
}

// SetOnMetricCollected sets a callback invoked after every metric collection.
// Used by RuleEvaluator to evaluate alert rules against fresh metrics.
func (m *CollectorManager) SetOnMetricCollected(fn func(hostID, hostName string, metric *models.SystemMetric)) {
	m.onMetricCollected = fn
}

// Register sets the local collector.
func (m *CollectorManager) Register(c *LocalCollector) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.collector = c
	m.snapshots = make([]models.SystemMetric, 0, int(m.storeInterval/m.collectInterval))
	log.Printf("Collector registered for host: %s", c.HostID())
}

// GetCollector returns the collector for the given host, or nil.
func (m *CollectorManager) GetCollector(hostID string) *LocalCollector {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.collector != nil && m.collector.HostID() == hostID {
		return m.collector
	}
	return nil
}

// GetLatestInfo returns the most recently cached SystemInfo for a host.
func (m *CollectorManager) GetLatestInfo(hostID string) *models.SystemInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.collector != nil && m.collector.HostID() == hostID {
		return m.latest
	}
	return nil
}

// Start begins the periodic collection and storage loops.
func (m *CollectorManager) Start() {
	m.collectTicker = time.NewTicker(m.collectInterval)
	m.storeTicker = time.NewTicker(m.storeInterval)

	log.Printf("CollectorManager started (collect: %v, store: %v)",
		m.collectInterval, m.storeInterval)

	go func() {
		for {
			select {
			case <-m.collectTicker.C:
				m.collect()
			case <-m.storeTicker.C:
				m.store()
			case <-m.stopCh:
				return
			}
		}
	}()
}

// Stop halts collection and closes the collector.
func (m *CollectorManager) Stop() {
	close(m.stopCh)
	if m.collectTicker != nil {
		m.collectTicker.Stop()
	}
	if m.storeTicker != nil {
		m.storeTicker.Stop()
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if m.collector != nil {
		m.collector.Close()
		m.collector = nil
	}

	log.Println("CollectorManager stopped")
}

// collect gathers a single snapshot from the local collector.
func (m *CollectorManager) collect() {
	m.mu.RLock()
	c := m.collector
	m.mu.RUnlock()
	if c == nil {
		return
	}

	snapshot, err := c.Collect()
	if err != nil {
		log.Printf("Collect failed for host %s: %v", c.HostID(), err)
		return
	}

	// Also get system info (cached for handler use). Overlay the freshly
	// computed delta-based metrics so the cached SystemInfo always reflects
	// the latest CPU / disk-I/O / network values — GetSystemInfo() on its
	// own cannot compute deltas.
	info, err := c.GetSystemInfo()
	if err == nil {
		info.CPU.Usage = snapshot.CPUUsage
		info.Disk.ReadSpeed = snapshot.DiskRead
		info.Disk.WriteSpeed = snapshot.DiskWrite
		info.Network = models.NetInfo{In: snapshot.NetIn, Out: snapshot.NetOut}
		m.mu.Lock()
		m.latest = info
		m.mu.Unlock()
	}

	// Buffer the snapshot
	m.mu.Lock()
	m.snapshots = append(m.snapshots, *snapshot)
	maxSnapshots := int(m.storeInterval / m.collectInterval)
	if len(m.snapshots) > maxSnapshots {
		m.snapshots = m.snapshots[len(m.snapshots)-maxSnapshots:]
	}
	m.mu.Unlock()

	// Broadcast via WebSocket
	if m.broadcast != nil {
		m.broadcast(map[string]interface{}{
			"type":   "system_metric",
			"hostId": c.HostID(),
			"data": map[string]interface{}{
				"cpu": snapshot.CPUUsage,
				"memory": map[string]interface{}{
					"total": snapshot.MemTotal,
					"used":  snapshot.MemUsed,
					"usage": snapshot.MemUsage,
				},
				"disk": map[string]interface{}{
					"total":      snapshot.DiskTotal,
					"used":       snapshot.DiskUsed,
					"usage":      snapshot.DiskUsage,
					"readSpeed":  snapshot.DiskRead,
					"writeSpeed": snapshot.DiskWrite,
				},
				"timestamp": snapshot.CreatedAt.Format(time.RFC3339),
			},
		})
	}

	// Notify evaluator for alert rule evaluation
	if m.onMetricCollected != nil {
		hostName := c.HostID()
		m.mu.RLock()
		if m.latest != nil {
			hostName = m.latest.Hostname
		}
		m.mu.RUnlock()
		go m.onMetricCollected(c.HostID(), hostName, snapshot)
	}
}

// store aggregates buffered snapshots and writes a 1-minute average to the DB.
func (m *CollectorManager) store() {
	m.mu.Lock()
	if m.collector == nil || len(m.snapshots) == 0 {
		m.mu.Unlock()
		return
	}

	n := float64(len(m.snapshots))
	avg := models.SystemMetric{
		HostID:    m.collector.HostID(),
		CreatedAt: time.Now(),
	}
	for _, s := range m.snapshots {
		avg.CPUUsage += s.CPUUsage
		avg.MemTotal += s.MemTotal
		avg.MemUsed += s.MemUsed
		avg.MemUsage += s.MemUsage
		avg.DiskTotal += s.DiskTotal
		avg.DiskUsed += s.DiskUsed
		avg.DiskUsage += s.DiskUsage
		avg.DiskRead += s.DiskRead
		avg.DiskWrite += s.DiskWrite
		avg.NetIn += s.NetIn
		avg.NetOut += s.NetOut
	}
	avg.CPUUsage = math.Round(avg.CPUUsage/n*10) / 10
	avg.MemTotal = math.Round(avg.MemTotal/n*10) / 10
	avg.MemUsed = math.Round(avg.MemUsed/n*10) / 10
	avg.MemUsage = math.Round(avg.MemUsage/n*10) / 10
	avg.DiskTotal = math.Round(avg.DiskTotal/n*10) / 10
	avg.DiskUsed = math.Round(avg.DiskUsed/n*10) / 10
	avg.DiskUsage = math.Round(avg.DiskUsage/n*10) / 10
	// Throughput fields keep 3-decimal precision (~KB/s): rounding to
	// 0.1 MB/s here would collapse normal sub-100KB/s traffic to 0.
	avg.DiskRead = math.Round(avg.DiskRead/n*1000) / 1000
	avg.DiskWrite = math.Round(avg.DiskWrite/n*1000) / 1000
	avg.NetIn = math.Round(avg.NetIn/n*1000) / 1000
	avg.NetOut = math.Round(avg.NetOut/n*1000) / 1000

	m.snapshots = m.snapshots[:0]
	m.mu.Unlock()

	if err := m.repo.Create(&avg); err != nil {
		log.Printf("Failed to store metric for host %s: %v", avg.HostID, err)
	}
}
