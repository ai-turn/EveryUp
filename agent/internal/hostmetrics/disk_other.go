//go:build !linux

package hostmetrics

func diskStats(path string) (pct, totalGB, usedGB float64, err error) {
	return 0, 0, 0, nil
}
