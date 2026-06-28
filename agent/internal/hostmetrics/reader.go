package hostmetrics

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Snapshot struct {
	CPUPercent    float64
	MemoryPercent float64
	MemTotalGB    float64
	MemUsedGB     float64
	DiskPercent   float64
	DiskTotalGB   float64
	DiskUsedGB    float64
	NetInMBps     float64
	NetOutMBps    float64
}

type Reader struct {
	root string

	mu        sync.Mutex
	lastCPU   cpuSample
	seenCPU   bool
	lastNet   netSample
	lastNetAt time.Time
	seenNet   bool
	diskPath  string
}

type cpuSample struct {
	idle  uint64
	total uint64
}

type netSample struct {
	rxBytes uint64
	txBytes uint64
}

func New(root, diskPath string) *Reader {
	if strings.TrimSpace(root) == "" {
		root = "/hostfs"
	}
	if strings.TrimSpace(diskPath) == "" {
		diskPath = root
	}
	return &Reader{root: strings.TrimRight(root, string(os.PathSeparator)), diskPath: diskPath}
}

func (r *Reader) Snapshot(ctx context.Context) (Snapshot, error) {
	if err := ctx.Err(); err != nil {
		return Snapshot{}, err
	}
	cpu, err := r.cpuPercent()
	if err != nil {
		return Snapshot{}, err
	}
	memPct, memTotal, memUsed, err := r.memoryStats()
	if err != nil {
		return Snapshot{}, err
	}
	diskPct, diskTotal, diskUsed, err := diskStats(r.diskPath)
	if err != nil {
		return Snapshot{}, err
	}
	// ponytail: net is non-fatal — a /proc/net/dev read failure shouldn't drop cpu/mem/disk.
	netIn, netOut, _ := r.netThroughput()
	return Snapshot{
		CPUPercent:    cpu,
		MemoryPercent: memPct,
		MemTotalGB:    memTotal,
		MemUsedGB:     memUsed,
		DiskPercent:   diskPct,
		DiskTotalGB:   diskTotal,
		DiskUsedGB:    diskUsed,
		NetInMBps:     netIn,
		NetOutMBps:    netOut,
	}, nil
}

// netThroughput returns receive/transmit rates in MB/s, measured as the byte
// delta over wall-clock elapsed since the previous call. First call returns 0
// (no baseline yet), mirroring cpuPercent.
func (r *Reader) netThroughput() (inMBps, outMBps float64, err error) {
	current, err := readNetSample(filepath.Join(r.root, "proc", "net", "dev"))
	if err != nil {
		return 0, 0, err
	}
	now := time.Now()
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.seenNet {
		r.lastNet = current
		r.lastNetAt = now
		r.seenNet = true
		return 0, 0, nil
	}
	elapsed := now.Sub(r.lastNetAt).Seconds()
	prev := r.lastNet
	r.lastNet = current
	r.lastNetAt = now
	// Skip on no elapsed time or a counter reset (reboot / iface flap).
	if elapsed <= 0 || current.rxBytes < prev.rxBytes || current.txBytes < prev.txBytes {
		return 0, 0, nil
	}
	const bytesPerMB = 1024 * 1024
	inMBps = float64(current.rxBytes-prev.rxBytes) / elapsed / bytesPerMB
	outMBps = float64(current.txBytes-prev.txBytes) / elapsed / bytesPerMB
	return inMBps, outMBps, nil
}

func (r *Reader) cpuPercent() (float64, error) {
	current, err := readCPUSample(filepath.Join(r.root, "proc", "stat"))
	if err != nil {
		return 0, err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.seenCPU {
		r.lastCPU = current
		r.seenCPU = true
		return 0, nil
	}
	prev := r.lastCPU
	r.lastCPU = current
	totalDelta := current.total - prev.total
	idleDelta := current.idle - prev.idle
	if totalDelta == 0 || idleDelta > totalDelta {
		return 0, nil
	}
	return (float64(totalDelta-idleDelta) / float64(totalDelta)) * 100, nil
}

func (r *Reader) memoryStats() (pct, totalGB, usedGB float64, err error) {
	total, available, e := readMemInfo(filepath.Join(r.root, "proc", "meminfo"))
	if e != nil {
		err = e
		return
	}
	if total == 0 || available > total {
		return
	}
	used := total - available
	pct = (float64(used) / float64(total)) * 100
	totalGB = float64(total) / 1e9
	usedGB = float64(used) / 1e9
	return
}

func readCPUSample(path string) (cpuSample, error) {
	file, err := os.Open(path)
	if err != nil {
		return cpuSample{}, fmt.Errorf("read cpu stat: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	if !scanner.Scan() {
		return cpuSample{}, fmt.Errorf("cpu stat is empty")
	}
	fields := strings.Fields(scanner.Text())
	if len(fields) < 5 || fields[0] != "cpu" {
		return cpuSample{}, fmt.Errorf("invalid cpu stat")
	}
	var values []uint64
	for _, field := range fields[1:] {
		value, err := strconv.ParseUint(field, 10, 64)
		if err != nil {
			return cpuSample{}, fmt.Errorf("parse cpu stat: %w", err)
		}
		values = append(values, value)
	}
	total := uint64(0)
	for _, value := range values {
		total += value
	}
	idle := values[3]
	if len(values) > 4 {
		idle += values[4]
	}
	return cpuSample{idle: idle, total: total}, nil
}

// readNetSample sums receive/transmit bytes across all interfaces except
// loopback from /proc/net/dev. Each data line is "iface: rxBytes ... txBytes ...",
// with rx in field 0 and tx in field 8 after the colon.
func readNetSample(path string) (netSample, error) {
	file, err := os.Open(path)
	if err != nil {
		return netSample{}, fmt.Errorf("read net dev: %w", err)
	}
	defer file.Close()

	var sum netSample
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		colon := strings.IndexByte(line, ':')
		if colon < 0 {
			continue // header rows have no "iface:" prefix
		}
		if strings.TrimSpace(line[:colon]) == "lo" {
			continue
		}
		fields := strings.Fields(line[colon+1:])
		if len(fields) < 16 {
			continue
		}
		rx, err1 := strconv.ParseUint(fields[0], 10, 64)
		tx, err2 := strconv.ParseUint(fields[8], 10, 64)
		if err1 != nil || err2 != nil {
			continue
		}
		sum.rxBytes += rx
		sum.txBytes += tx
	}
	if err := scanner.Err(); err != nil {
		return netSample{}, err
	}
	return sum, nil
}

func readMemInfo(path string) (uint64, uint64, error) {
	file, err := os.Open(path)
	if err != nil {
		return 0, 0, fmt.Errorf("read meminfo: %w", err)
	}
	defer file.Close()

	var total uint64
	var available uint64
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 2 {
			continue
		}
		value, err := strconv.ParseUint(fields[1], 10, 64)
		if err != nil {
			continue
		}
		switch strings.TrimSuffix(fields[0], ":") {
		case "MemTotal":
			total = value * 1024
		case "MemAvailable":
			available = value * 1024
		}
	}
	if err := scanner.Err(); err != nil {
		return 0, 0, err
	}
	if total == 0 {
		return 0, 0, fmt.Errorf("MemTotal missing")
	}
	if available == 0 {
		return 0, 0, fmt.Errorf("MemAvailable missing")
	}
	return total, available, nil
}
