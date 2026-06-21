//go:build linux

package hostmetrics

import "syscall"

func diskStats(path string) (pct, totalGB, usedGB float64, err error) {
	var stat syscall.Statfs_t
	if err = syscall.Statfs(path, &stat); err != nil {
		return
	}
	total := stat.Blocks * uint64(stat.Bsize)
	available := stat.Bavail * uint64(stat.Bsize)
	if total == 0 || available > total {
		return
	}
	used := total - available
	pct = (float64(used) / float64(total)) * 100
	totalGB = float64(total) / 1e9
	usedGB = float64(used) / 1e9
	return
}
