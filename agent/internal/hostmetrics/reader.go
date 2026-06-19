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
)

type Snapshot struct {
	CPUPercent    float64
	MemoryPercent float64
	DiskPercent   float64
}

type Reader struct {
	root string

	mu       sync.Mutex
	lastCPU  cpuSample
	seenCPU  bool
	diskPath string
}

type cpuSample struct {
	idle  uint64
	total uint64
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
	memory, err := r.memoryPercent()
	if err != nil {
		return Snapshot{}, err
	}
	disk, err := diskUsagePercent(r.diskPath)
	if err != nil {
		return Snapshot{}, err
	}
	return Snapshot{CPUPercent: cpu, MemoryPercent: memory, DiskPercent: disk}, nil
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

func (r *Reader) memoryPercent() (float64, error) {
	total, available, err := readMemInfo(filepath.Join(r.root, "proc", "meminfo"))
	if err != nil {
		return 0, err
	}
	if total == 0 || available > total {
		return 0, nil
	}
	return (float64(total-available) / float64(total)) * 100, nil
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
