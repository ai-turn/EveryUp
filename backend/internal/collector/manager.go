package collector

import (
	"log"
	"math"
	"sync"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// managedCollector wraps a MetricCollector with its in-memory snapshot buffer
// and cached system info.
type managedCollector struct {
	collector MetricCollector
	snapshots []models.SystemMetric
	latest    *models.SystemInfo
}

// CollectorManager manages multiple MetricCollectors and schedules periodic
// collection and storage.
type CollectorManager struct {
	collectors         map[string]*managedCollector // hostID → managed collector
	broadcast          func(interface{})
	onMetricCollected  func(hostID, hostName string, metric *models.SystemMetric)
	repo               *database.SystemMetricRepository
	mu                 sync.RWMutex

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
		collectors:      make(map[string]*managedCollector),
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

// Register adds a MetricCollector to be managed. If a collector for the same
// host ID already exists, it is replaced (the old one is closed).
func (m *CollectorManager) Register(c MetricCollector) {
	m.mu.Lock()
	defer m.mu.Unlock()

	hostID := c.HostID()
	if existing, ok := m.collectors[hostID]; ok {
		existing.collector.Close()
	}

	maxSnapshots := int(m.storeInterval / m.collectInterval)
	m.collectors[hostID] = &managedCollector{
		collector: c,
		snapshots: make([]models.SystemMetric, 0, maxSnapshots),
	}

	log.Printf("Collector registered for host: %s", hostID)
}

// Unregister removes and closes the collector for the given host ID.
func (m *CollectorManager) Unregister(hostID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if mc, ok := m.collectors[hostID]; ok {
		mc.collector.Close()
		delete(m.collectors, hostID)
		log.Printf("Collector unregistered for host: %s", hostID)
	}
}

// RegisterSSHHost creates and registers an SSHCollector for the given host.
// Returns an error if the SSH configuration is invalid (does not attempt connection).
func (m *CollectorManager) RegisterSSHHost(host *models.Host) error {
	sshCollector, err := NewSSHCollector(host)
	if err != nil {
		return err
	}
	m.Register(sshCollector)
	return nil
}

// GetCollector returns the MetricCollector for the given host, or nil.
func (m *CollectorManager) GetCollector(hostID string) MetricCollector {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if mc, ok := m.collectors[hostID]; ok {
		return mc.collector
	}
	return nil
}

// GetLatestInfo returns the most recently cached SystemInfo for a host.
func (m *CollectorManager) GetLatestInfo(hostID string) *models.SystemInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if mc, ok := m.collectors[hostID]; ok {
		return mc.latest
	}
	return nil
}

// HasCollector returns true if a collector is registered for the given host.
func (m *CollectorManager) HasCollector(hostID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	_, ok := m.collectors[hostID]
	return ok
}

// Start begins the periodic collection and storage loops.
func (m *CollectorManager) Start() {
	m.collectTicker = time.NewTicker(m.collectInterval)
	m.storeTicker = time.NewTicker(m.storeInterval)

	log.Printf("CollectorManager started (collect: %v, store: %v, hosts: %d)",
		m.collectInterval, m.storeInterval, len(m.collectors))

	go func() {
		for {
			select {
			case <-m.collectTicker.C:
				m.collectAll()
			case <-m.storeTicker.C:
				m.storeAll()
			case <-m.stopCh:
				return
			}
		}
	}()
}

// Stop halts all collection and closes every registered collector.
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

	for hostID, mc := range m.collectors {
		mc.collector.Close()
		log.Printf("Collector closed for host: %s", hostID)
	}
	m.collectors = make(map[string]*managedCollector)

	log.Println("CollectorManager stopped")
}

// collectAll runs Collect() on every registered collector in parallel.
func (m *CollectorManager) collectAll() {
	m.mu.Lock()

	// Build a snapshot of collectors to iterate without holding the lock
	// during potentially slow SSH calls.
	type job struct {
		hostID string
		mc     *managedCollector
	}
	jobs := make([]job, 0, len(m.collectors))
	for id, mc := range m.collectors {
		jobs = append(jobs, job{hostID: id, mc: mc})
	}
	m.mu.Unlock()

	var wg sync.WaitGroup
	for _, j := range jobs {
		wg.Add(1)
		go func(hostID string, mc *managedCollector) {
			defer wg.Done()
			m.collectOne(hostID, mc)
		}(j.hostID, j.mc)
	}
	wg.Wait()
}

// collectOne collects a single snapshot from one host.
func (m *CollectorManager) collectOne(hostID string, mc *managedCollector) {
	snapshot, err := mc.collector.Collect()
	if err != nil {
		log.Printf("Collect failed for host %s: %v", hostID, err)
		return
	}

	// Also get system info (cached for handler use). Overlay the freshly
	// computed delta-based metrics so the cached SystemInfo always reflects
	// the latest CPU / disk-I/O / network values — GetSystemInfo() on its
	// own cannot compute deltas (SSH returns CPU=0, no net/io fields).
	info, err := mc.collector.GetSystemInfo()
	if err == nil {
		info.CPU.Usage = snapshot.CPUUsage
		info.Disk.ReadSpeed = snapshot.DiskRead
		info.Disk.WriteSpeed = snapshot.DiskWrite
		info.Network = models.NetInfo{In: snapshot.NetIn, Out: snapshot.NetOut}
		m.mu.Lock()
		mc.latest = info
		m.mu.Unlock()
	}

	// Buffer the snapshot
	m.mu.Lock()
	mc.snapshots = append(mc.snapshots, *snapshot)
	maxSnapshots := int(m.storeInterval / m.collectInterval)
	if len(mc.snapshots) > maxSnapshots {
		mc.snapshots = mc.snapshots[len(mc.snapshots)-maxSnapshots:]
	}
	m.mu.Unlock()

	// Broadcast via WebSocket
	if m.broadcast != nil {
		m.broadcast(map[string]interface{}{
			"type":   "system_metric",
			"hostId": hostID,
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
		hostName := hostID
		m.mu.RLock()
		if mc.latest != nil {
			hostName = mc.latest.Hostname
		}
		m.mu.RUnlock()
		go m.onMetricCollected(hostID, hostName, snapshot)
	}
}

// storeAll aggregates recent snapshots for each host and writes 1-minute
// averages to the database.
func (m *CollectorManager) storeAll() {
	m.mu.Lock()

	type avgJob struct {
		avg models.SystemMetric
	}
	var toStore []avgJob

	for _, mc := range m.collectors {
		if len(mc.snapshots) == 0 {
			continue
		}

		n := float64(len(mc.snapshots))
		avg := models.SystemMetric{
			HostID:    mc.collector.HostID(),
			CreatedAt: time.Now(),
		}
		for _, s := range mc.snapshots {
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
		avg.DiskRead = math.Round(avg.DiskRead/n*10) / 10
		avg.DiskWrite = math.Round(avg.DiskWrite/n*10) / 10
		avg.NetIn = math.Round(avg.NetIn/n*10) / 10
		avg.NetOut = math.Round(avg.NetOut/n*10) / 10

		mc.snapshots = mc.snapshots[:0]
		toStore = append(toStore, avgJob{avg: avg})
	}
	m.mu.Unlock()

	for _, j := range toStore {
		avg := j.avg
		if err := m.repo.Create(&avg); err != nil {
			log.Printf("Failed to store metric for host %s: %v", avg.HostID, err)
		}
	}
}

// GetHistory returns time-series data from the database for a host.
// Data is downsampled into fixed-size time buckets so charts always receive
// ~72 clean data points regardless of the raw 1-minute storage granularity:
//
//	6H  → 5-minute buckets  → up to 72 points
//	12H → 10-minute buckets → up to 72 points
//	24H → 20-minute buckets → up to 72 points
func (m *CollectorManager) GetHistory(hostID, rangeStr string) (*models.SystemMetricsHistory, error) {
	var duration    time.Duration
	var bucketMins  int

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
	points, err := m.repo.GetHistory(hostID, since, bucketMins)
	if err != nil {
		return nil, err
	}

	return &models.SystemMetricsHistory{
		Range:  rangeStr,
		Points: points,
	}, nil
}
