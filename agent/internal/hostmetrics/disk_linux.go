//go:build linux

package hostmetrics

import "syscall"

func diskUsagePercent(path string) (float64, error) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return 0, err
	}
	total := stat.Blocks * uint64(stat.Bsize)
	available := stat.Bavail * uint64(stat.Bsize)
	if total == 0 || available > total {
		return 0, nil
	}
	return (float64(total-available) / float64(total)) * 100, nil
}
