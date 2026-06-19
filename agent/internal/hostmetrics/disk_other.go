//go:build !linux

package hostmetrics

func diskUsagePercent(path string) (float64, error) {
	return 0, nil
}
