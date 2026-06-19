package collector

import "fmt"

// Common helper functions shared by all collector implementations.

func roundGB(bytes uint64) float64 {
	return float64(int(float64(bytes)/(1024*1024*1024)*10)) / 10
}

func roundMBs(bytesDelta uint64, seconds float64) float64 {
	mbps := float64(bytesDelta) / (1024 * 1024) / seconds
	// 3-decimal precision (~KB/s): network/disk throughput often sits below
	// 0.1 MB/s, which a coarser round would collapse to a flat 0.
	return float64(int(mbps*1000)) / 1000
}

func formatBytes(b uint64) string {
	const (
		KB = 1024
		MB = KB * 1024
		GB = MB * 1024
	)
	switch {
	case b >= GB:
		return fmt.Sprintf("%.1f GB", float64(b)/float64(GB))
	case b >= MB:
		return fmt.Sprintf("%d MB", b/MB)
	case b >= KB:
		return fmt.Sprintf("%d KB", b/KB)
	default:
		return fmt.Sprintf("%d B", b)
	}
}

func normalizeStatus(s string) string {
	switch s {
	case "R", "running":
		return "running"
	case "S", "sleeping", "idle":
		return "sleeping"
	case "T", "stopped":
		return "stopped"
	case "Z", "zombie":
		return "zombie"
	default:
		return "running"
	}
}
