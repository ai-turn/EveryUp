package parser

import (
	"fmt"
	"strconv"
	"strings"
)

// CPURaw holds raw CPU jiffies from /proc/stat for delta calculation.
type CPURaw struct {
	User, Nice, System, Idle, IOWait, IRQ, SoftIRQ, Steal uint64
}

// Total returns the total CPU jiffies.
func (c *CPURaw) Total() uint64 {
	return c.User + c.Nice + c.System + c.Idle + c.IOWait + c.IRQ + c.SoftIRQ + c.Steal
}

// IdleTotal returns idle + iowait.
func (c *CPURaw) IdleTotal() uint64 {
	return c.Idle + c.IOWait
}

// MemoryInfo holds parsed /proc/meminfo data.
type MemoryInfo struct {
	TotalKB     uint64
	AvailableKB uint64
	TotalGB     float64
	UsedGB      float64
	UsagePercent float64
}

// DiskUsageInfo holds parsed df output.
type DiskUsageInfo struct {
	TotalGB      float64
	UsedGB       float64
	UsagePercent float64
}

// DiskIORaw holds raw disk I/O counters for delta calculation.
type DiskIORaw struct {
	ReadSectors  uint64
	WriteSectors uint64
}

// NetworkRaw holds raw network byte counters for delta calculation.
type NetworkRaw struct {
	BytesRecv uint64
	BytesSent uint64
}

// ProcessInfo holds a single parsed process entry from ps aux.
type ProcessInfo struct {
	PID    int32
	Name   string
	CPU    float64
	Memory string // formatted string
	MemKB  uint64
	Status string
}

// ParseCPU parses /proc/stat content and returns the aggregate CPU line.
// Input: first line of /proc/stat:
//   cpu  10132153 290696 3084719 46828483 16683 0 25195 0 0 0
func ParseCPU(statContent string) (*CPURaw, error) {
	for _, line := range strings.Split(statContent, "\n") {
		if strings.HasPrefix(line, "cpu ") {
			fields := strings.Fields(line)
			if len(fields) < 9 {
				return nil, fmt.Errorf("unexpected /proc/stat cpu line: %s", line)
			}
			raw := &CPURaw{}
			raw.User, _ = strconv.ParseUint(fields[1], 10, 64)
			raw.Nice, _ = strconv.ParseUint(fields[2], 10, 64)
			raw.System, _ = strconv.ParseUint(fields[3], 10, 64)
			raw.Idle, _ = strconv.ParseUint(fields[4], 10, 64)
			raw.IOWait, _ = strconv.ParseUint(fields[5], 10, 64)
			raw.IRQ, _ = strconv.ParseUint(fields[6], 10, 64)
			raw.SoftIRQ, _ = strconv.ParseUint(fields[7], 10, 64)
			raw.Steal, _ = strconv.ParseUint(fields[8], 10, 64)
			return raw, nil
		}
	}
	return nil, fmt.Errorf("cpu line not found in /proc/stat")
}

// CalculateCPUUsage computes CPU usage percentage from two snapshots.
func CalculateCPUUsage(prev, curr *CPURaw) float64 {
	totalDelta := curr.Total() - prev.Total()
	if totalDelta == 0 {
		return 0
	}
	idleDelta := curr.IdleTotal() - prev.IdleTotal()
	usage := (1.0 - float64(idleDelta)/float64(totalDelta)) * 100
	return float64(int(usage*10)) / 10
}

// ParseMemory parses /proc/meminfo content.
func ParseMemory(meminfoContent string) (*MemoryInfo, error) {
	values := make(map[string]uint64)
	for _, line := range strings.Split(meminfoContent, "\n") {
		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}
		key := strings.TrimSuffix(parts[0], ":")
		val, _ := strconv.ParseUint(parts[1], 10, 64)
		values[key] = val
	}

	total, ok := values["MemTotal"]
	if !ok {
		return nil, fmt.Errorf("MemTotal not found in /proc/meminfo")
	}

	available, ok := values["MemAvailable"]
	if !ok {
		// Fallback: MemFree + Buffers + Cached
		available = values["MemFree"] + values["Buffers"] + values["Cached"]
	}

	used := total - available
	totalGB := float64(int(float64(total)/(1024*1024)*10)) / 10
	usedGB := float64(int(float64(used)/(1024*1024)*10)) / 10
	usage := float64(int(float64(used)/float64(total)*1000)) / 10

	return &MemoryInfo{
		TotalKB:      total,
		AvailableKB:  available,
		TotalGB:      totalGB,
		UsedGB:       usedGB,
		UsagePercent: usage,
	}, nil
}

// ParseDiskUsage parses `df -B1 /` output.
// Expected format:
//   Filesystem     1B-blocks        Used   Available Use% Mounted on
//   /dev/sda1      214748364800 51539607552 152177049600  26% /
func ParseDiskUsage(dfOutput string) (*DiskUsageInfo, error) {
	lines := strings.Split(strings.TrimSpace(dfOutput), "\n")
	// Find the data line (skip header)
	for _, line := range lines {
		if strings.HasPrefix(line, "Filesystem") || strings.TrimSpace(line) == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}
		// fields: Filesystem 1B-blocks Used Available Use% Mounted
		total, _ := strconv.ParseUint(fields[1], 10, 64)
		used, _ := strconv.ParseUint(fields[2], 10, 64)

		if total == 0 {
			continue
		}

		totalGB := float64(int(float64(total)/(1024*1024*1024)*10)) / 10
		usedGB := float64(int(float64(used)/(1024*1024*1024)*10)) / 10
		usage := float64(int(float64(used)/float64(total)*1000)) / 10

		return &DiskUsageInfo{
			TotalGB:      totalGB,
			UsedGB:       usedGB,
			UsagePercent: usage,
		}, nil
	}
	return nil, fmt.Errorf("no disk usage data found in df output")
}

// ParseDiskIO parses /proc/diskstats and returns total read/write sectors.
// Format: major minor name reads ... read_sectors ... writes ... write_sectors ...
// Fields (0-indexed): 0=major 1=minor 2=name 3=reads 4=merged 5=read_sectors
//                     6=read_ms 7=writes 8=merged 9=write_sectors
func ParseDiskIO(diskstatsContent string) (*DiskIORaw, error) {
	raw := &DiskIORaw{}
	for _, line := range strings.Split(diskstatsContent, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 14 {
			continue
		}
		name := fields[2]
		// Skip partition entries (e.g., sda1) — only count whole devices
		// Simple heuristic: skip names ending with a digit if a non-digit version exists
		if isPartition(name) {
			continue
		}
		readSectors, _ := strconv.ParseUint(fields[5], 10, 64)
		writeSectors, _ := strconv.ParseUint(fields[9], 10, 64)
		raw.ReadSectors += readSectors
		raw.WriteSectors += writeSectors
	}
	return raw, nil
}

// CalculateDiskIO computes disk I/O in MB/s from two snapshots.
// Sector size is 512 bytes.
// Guards against uint64 underflow: when counters reset (device hot-add/remove,
// reboot, or the underlying device set changes between samples) we return 0
// instead of a wrapped 2^64-scale delta.
func CalculateDiskIO(prev, curr *DiskIORaw, elapsedSec float64) (readMBps, writeMBps float64) {
	if elapsedSec <= 0 {
		return 0, 0
	}
	if curr.ReadSectors >= prev.ReadSectors {
		readBytes := float64(curr.ReadSectors-prev.ReadSectors) * 512
		readMBps = float64(int(readBytes/(1024*1024)/elapsedSec*10)) / 10
	}
	if curr.WriteSectors >= prev.WriteSectors {
		writeBytes := float64(curr.WriteSectors-prev.WriteSectors) * 512
		writeMBps = float64(int(writeBytes/(1024*1024)/elapsedSec*10)) / 10
	}
	return
}

// ParseNetwork parses /proc/net/dev and returns total recv/sent bytes
// for the first non-loopback interface.
func ParseNetwork(netdevContent string) (*NetworkRaw, error) {
	raw := &NetworkRaw{}
	for _, line := range strings.Split(netdevContent, "\n") {
		line = strings.TrimSpace(line)
		if !strings.Contains(line, ":") || strings.HasPrefix(line, "Inter") || strings.HasPrefix(line, "face") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) < 2 {
			continue
		}
		iface := strings.TrimSpace(parts[0])
		if iface == "lo" {
			continue
		}
		fields := strings.Fields(parts[1])
		if len(fields) < 9 {
			continue
		}
		recv, _ := strconv.ParseUint(fields[0], 10, 64)
		sent, _ := strconv.ParseUint(fields[8], 10, 64)
		raw.BytesRecv += recv
		raw.BytesSent += sent
	}
	return raw, nil
}

// CalculateNetworkIO computes network I/O in MB/s from two snapshots.
// Guards against uint64 underflow: interfaces appearing/disappearing between
// samples (e.g. Docker veth pairs) make `curr.Bytes* < prev.Bytes*` possible,
// which would otherwise wrap to a ~2^64 delta and pollute the metrics history.
func CalculateNetworkIO(prev, curr *NetworkRaw, elapsedSec float64) (recvMBps, sentMBps float64) {
	if elapsedSec <= 0 {
		return 0, 0
	}
	if curr.BytesRecv >= prev.BytesRecv {
		recvMBps = float64(int(float64(curr.BytesRecv-prev.BytesRecv)/(1024*1024)/elapsedSec*10)) / 10
	}
	if curr.BytesSent >= prev.BytesSent {
		sentMBps = float64(int(float64(curr.BytesSent-prev.BytesSent)/(1024*1024)/elapsedSec*10)) / 10
	}
	return
}

// ParseProcesses parses `ps aux --sort=-%cpu` output.
// Format: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
func ParseProcesses(psOutput string, limit int) []ProcessInfo {
	var procs []ProcessInfo
	lines := strings.Split(strings.TrimSpace(psOutput), "\n")
	for i, line := range lines {
		if i == 0 {
			continue // skip header
		}
		fields := strings.Fields(line)
		if len(fields) < 11 {
			continue
		}
		pid, _ := strconv.ParseInt(fields[1], 10, 32)
		cpuPct, _ := strconv.ParseFloat(fields[2], 64)
		rss, _ := strconv.ParseUint(fields[5], 10, 64) // RSS in KB
		stat := fields[7]

		// Command is everything from field 10 onwards
		name := fields[10]
		// Strip path prefix
		if idx := strings.LastIndex(name, "/"); idx >= 0 {
			name = name[idx+1:]
		}
		// Strip leading brackets/dashes
		name = strings.TrimLeft(name, "[-")
		name = strings.TrimRight(name, "]")

		status := "running"
		if len(stat) > 0 {
			switch stat[0] {
			case 'S':
				status = "sleeping"
			case 'T':
				status = "stopped"
			case 'Z':
				status = "zombie"
			case 'D':
				status = "running"
			}
		}

		memStr := formatKB(rss)

		procs = append(procs, ProcessInfo{
			PID:    int32(pid),
			Name:   name,
			CPU:    float64(int(cpuPct*10)) / 10,
			Memory: memStr,
			MemKB:  rss,
			Status: status,
		})

		if limit > 0 && len(procs) >= limit {
			break
		}
	}
	return procs
}

// ParseUptime parses /proc/uptime content.
// Format: "123456.78 234567.89" (uptime_seconds idle_seconds)
func ParseUptime(uptimeContent string) uint64 {
	fields := strings.Fields(strings.TrimSpace(uptimeContent))
	if len(fields) < 1 {
		return 0
	}
	// Parse as float, return integer seconds
	val, _ := strconv.ParseFloat(fields[0], 64)
	return uint64(val)
}

// ParseHostname parses hostname command output.
func ParseHostname(output string) string {
	return strings.TrimSpace(output)
}

// isPartition returns true if the device name looks like a partition (e.g., sda1, nvme0n1p1).
func isPartition(name string) bool {
	if len(name) == 0 {
		return false
	}
	// sd* devices: sda1, sdb2 — partitions end with digit after sd[a-z]
	if strings.HasPrefix(name, "sd") && len(name) > 3 {
		return name[len(name)-1] >= '0' && name[len(name)-1] <= '9'
	}
	// nvme: nvme0n1p1 — partitions contain 'p' followed by digit
	if strings.HasPrefix(name, "nvme") && strings.Contains(name, "p") {
		parts := strings.Split(name, "p")
		if len(parts) > 1 {
			last := parts[len(parts)-1]
			if len(last) > 0 && last[0] >= '0' && last[0] <= '9' {
				return true
			}
		}
	}
	return false
}

func formatKB(kb uint64) string {
	const (
		MB = 1024
		GB = MB * 1024
	)
	switch {
	case kb >= GB:
		return fmt.Sprintf("%.1f GB", float64(kb)/float64(GB))
	case kb >= MB:
		return fmt.Sprintf("%d MB", kb/MB)
	default:
		return fmt.Sprintf("%d KB", kb)
	}
}
