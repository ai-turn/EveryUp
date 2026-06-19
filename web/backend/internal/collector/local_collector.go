package collector

import (
	"fmt"
	"math"
	"net"
	"sort"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	gopsnet "github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"

	"github.com/aiturn/everyup/internal/models"
)

// Compile-time check that LocalCollector implements MetricCollector.
var _ MetricCollector = (*LocalCollector)(nil)

// LocalCollector collects metrics from the local host using gopsutil.
type LocalCollector struct {
	hostID string

	// Previous I/O counters for delta calculation
	prevDiskRead  uint64
	prevDiskWrite uint64
	prevNetIn     uint64
	prevNetOut    uint64
	prevTime      time.Time
}

// NewLocalCollector creates a new local collector for the given host ID.
func NewLocalCollector(hostID string) *LocalCollector {
	c := &LocalCollector{hostID: hostID}
	c.initIOCounters()
	return c
}

// HostID returns the host identifier.
func (c *LocalCollector) HostID() string {
	return c.hostID
}

// Close is a no-op for the local collector.
func (c *LocalCollector) Close() error {
	return nil
}

// Collect gathers a single snapshot of CPU, memory, disk, and network metrics.
func (c *LocalCollector) Collect() (*models.SystemMetric, error) {
	now := time.Now()

	// CPU
	cpuPercents, err := cpu.Percent(0, false)
	if err != nil || len(cpuPercents) == 0 {
		return nil, fmt.Errorf("failed to get CPU: %w", err)
	}
	cpuUsage := math.Round(cpuPercents[0]*10) / 10

	// Memory
	memStat, err := mem.VirtualMemory()
	if err != nil {
		return nil, fmt.Errorf("failed to get memory: %w", err)
	}
	memTotal := roundGB(memStat.Total)
	memUsed := roundGB(memStat.Used)
	memUsage := math.Round(memStat.UsedPercent*10) / 10

	// Disk usage
	diskStat, err := disk.Usage("/")
	if err != nil {
		diskStat, err = disk.Usage("C:")
		if err != nil {
			return nil, fmt.Errorf("failed to get disk: %w", err)
		}
	}
	diskTotal := roundGB(diskStat.Total)
	diskUsed := roundGB(diskStat.Used)
	diskUsage := math.Round(diskStat.UsedPercent*10) / 10

	// Disk I/O delta
	var diskReadSpeed, diskWriteSpeed float64
	diskCounters, err := disk.IOCounters()
	if err == nil {
		var totalRead, totalWrite uint64
		for _, counter := range diskCounters {
			totalRead += counter.ReadBytes
			totalWrite += counter.WriteBytes
		}
		if !c.prevTime.IsZero() {
			elapsed := now.Sub(c.prevTime).Seconds()
			if elapsed > 0 {
				diskReadSpeed = roundMBs(totalRead-c.prevDiskRead, elapsed)
				diskWriteSpeed = roundMBs(totalWrite-c.prevDiskWrite, elapsed)
			}
		}
		c.prevDiskRead = totalRead
		c.prevDiskWrite = totalWrite
	}

	// Network I/O delta
	var netInSpeed, netOutSpeed float64
	netCounters, err := gopsnet.IOCounters(false)
	if err == nil && len(netCounters) > 0 {
		if !c.prevTime.IsZero() {
			elapsed := now.Sub(c.prevTime).Seconds()
			if elapsed > 0 {
				netInSpeed = roundMBs(netCounters[0].BytesRecv-c.prevNetIn, elapsed)
				netOutSpeed = roundMBs(netCounters[0].BytesSent-c.prevNetOut, elapsed)
			}
		}
		c.prevNetIn = netCounters[0].BytesRecv
		c.prevNetOut = netCounters[0].BytesSent
	}

	c.prevTime = now

	return &models.SystemMetric{
		HostID:    c.hostID,
		CPUUsage:  cpuUsage,
		MemTotal:  memTotal,
		MemUsed:   memUsed,
		MemUsage:  memUsage,
		DiskTotal: diskTotal,
		DiskUsed:  diskUsed,
		DiskUsage: diskUsage,
		DiskRead:  diskReadSpeed,
		DiskWrite: diskWriteSpeed,
		NetIn:     netInSpeed,
		NetOut:    netOutSpeed,
		CreatedAt: now,
	}, nil
}

// GetSystemInfo returns host information with the current resource snapshot.
func (c *LocalCollector) GetSystemInfo() (*models.SystemInfo, error) {
	// CPU
	cpuPercents, err := cpu.Percent(0, false)
	if err != nil || len(cpuPercents) == 0 {
		return nil, fmt.Errorf("failed to get CPU: %w", err)
	}
	cpuUsage := math.Round(cpuPercents[0]*10) / 10
	cpuCount, _ := cpu.Counts(true)

	// Memory
	memStat, err := mem.VirtualMemory()
	if err != nil {
		return nil, fmt.Errorf("failed to get memory: %w", err)
	}

	// Disk
	diskStat, err := disk.Usage("/")
	if err != nil {
		diskStat, err = disk.Usage("C:")
		if err != nil {
			return nil, fmt.Errorf("failed to get disk: %w", err)
		}
	}

	info := &models.SystemInfo{
		Hostname: "localhost",
		OS:       "unknown",
		Platform: "unknown",
		Kernel:   "unknown",
		Uptime:   0,
		IP:       getLocalIP(),
		CPU:      models.CPUInfo{Cores: cpuCount, Usage: cpuUsage},
		Memory: models.MemInfo{
			Total: roundGB(memStat.Total),
			Used:  roundGB(memStat.Used),
			Usage: math.Round(memStat.UsedPercent*10) / 10,
		},
		Disk: models.DiskInfo{
			Total: roundGB(diskStat.Total),
			Used:  roundGB(diskStat.Used),
			Usage: math.Round(diskStat.UsedPercent*10) / 10,
		},
	}

	hostInfo, _ := host.Info()
	if hostInfo != nil {
		info.Hostname = hostInfo.Hostname
		info.OS = hostInfo.OS
		info.Platform = fmt.Sprintf("%s %s", hostInfo.Platform, hostInfo.PlatformVersion)
		info.Kernel = hostInfo.KernelVersion
		info.Uptime = hostInfo.Uptime
	}

	return info, nil
}

// GetProcesses returns the top N processes sorted by the given field.
func (c *LocalCollector) GetProcesses(limit int, sortBy string) ([]models.ProcessInfo, error) {
	procs, err := process.Processes()
	if err != nil {
		return nil, fmt.Errorf("failed to get processes: %w", err)
	}

	var results []models.ProcessInfo
	for _, p := range procs {
		name, err := p.Name()
		if err != nil || name == "" {
			continue
		}

		cpuPct, _ := p.CPUPercent()
		memInfo, err := p.MemoryInfo()
		if err != nil {
			continue
		}

		statusSlice, _ := p.Status()
		status := "running"
		if len(statusSlice) > 0 {
			status = normalizeStatus(statusSlice[0])
		}

		memBytes := uint64(0)
		if memInfo != nil {
			memBytes = memInfo.RSS
		}

		results = append(results, models.ProcessInfo{
			PID:         p.Pid,
			Name:        name,
			CPU:         math.Round(cpuPct*10) / 10,
			Memory:      formatBytes(memBytes),
			MemoryBytes: memBytes,
			Status:      status,
		})
	}

	switch sortBy {
	case "memory":
		sort.Slice(results, func(i, j int) bool {
			return results[i].MemoryBytes > results[j].MemoryBytes
		})
	default:
		sort.Slice(results, func(i, j int) bool {
			return results[i].CPU > results[j].CPU
		})
	}

	if limit > 0 && limit < len(results) {
		results = results[:limit]
	}
	return results, nil
}

// initIOCounters initializes the previous I/O counters for delta calculation.
func (c *LocalCollector) initIOCounters() {
	diskCounters, err := disk.IOCounters()
	if err == nil {
		for _, counter := range diskCounters {
			c.prevDiskRead += counter.ReadBytes
			c.prevDiskWrite += counter.WriteBytes
		}
	}

	netCounters, err := gopsnet.IOCounters(false)
	if err == nil && len(netCounters) > 0 {
		c.prevNetIn = netCounters[0].BytesRecv
		c.prevNetOut = netCounters[0].BytesSent
	}

	c.prevTime = time.Now()
}

func getLocalIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "127.0.0.1"
	}
	for _, addr := range addrs {
		if ipNet, ok := addr.(*net.IPNet); ok && !ipNet.IP.IsLoopback() {
			if ipNet.IP.To4() != nil {
				return ipNet.IP.String()
			}
		}
	}
	return "127.0.0.1"
}
