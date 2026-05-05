package database

import (
	"database/sql"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// SystemMetricRepository handles system metric data operations
type SystemMetricRepository struct{}

// NewSystemMetricRepository creates a new system metric repository
func NewSystemMetricRepository() *SystemMetricRepository {
	return &SystemMetricRepository{}
}

// Create stores a 1-minute aggregate system metric
func (r *SystemMetricRepository) Create(m *models.SystemMetric) error {
	result, err := DB.Exec(`
		INSERT INTO system_metrics (host_id, cpu_usage, mem_total, mem_used, mem_usage,
		                            disk_total, disk_used, disk_usage,
		                            disk_read, disk_write, net_in, net_out, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, m.HostID, m.CPUUsage, m.MemTotal, m.MemUsed, m.MemUsage,
		m.DiskTotal, m.DiskUsed, m.DiskUsage,
		m.DiskRead, m.DiskWrite, m.NetIn, m.NetOut, m.CreatedAt)
	if err != nil {
		return err
	}

	id, _ := result.LastInsertId()
	m.ID = id
	return nil
}

// GetHistory returns system metrics for a given host and time range, downsampled into
// bucketMinutes-wide AVG buckets so the chart always receives ~60-80 clean data points
// regardless of how many 1-minute rows are stored.
//
// bucket formula (SQLite):
//
//	strftime('%Y-%m-%dT%H:', ts) || printf('%02d', (strftime('%M', ts) / N) * N) || ':00Z'
func (r *SystemMetricRepository) GetHistory(hostID string, since time.Time, bucketMinutes int) ([]models.SystemMetricPoint, error) {
	if bucketMinutes <= 0 {
		bucketMinutes = 1
	}

	rows, err := DB.Query(`
		SELECT
			strftime('%Y-%m-%dT%H:', created_at) ||
			printf('%02d', (CAST(strftime('%M', created_at) AS INTEGER) / ?) * ?) || ':00Z' AS bucket,
			ROUND(AVG(cpu_usage), 1)  AS cpu,
			ROUND(AVG(mem_used),  2)  AS mem_used,
			ROUND(AVG(disk_read), 3)  AS disk_read,
			ROUND(AVG(disk_write),3)  AS disk_write,
			ROUND(AVG(net_in),    3)  AS net_in,
			ROUND(AVG(net_out),   3)  AS net_out
		FROM system_metrics
		WHERE host_id = ? AND created_at >= ?
		GROUP BY bucket
		ORDER BY bucket ASC
	`, bucketMinutes, bucketMinutes, hostID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var points []models.SystemMetricPoint
	for rows.Next() {
		var p models.SystemMetricPoint
		if err := rows.Scan(&p.Timestamp, &p.CPU, &p.MemUsed, &p.DiskRead, &p.DiskWrite, &p.NetIn, &p.NetOut); err != nil {
			return nil, err
		}
		points = append(points, p)
	}
	return points, nil
}

// GetLatestByHosts returns the most recent metric for each host ID.
func (r *SystemMetricRepository) GetLatestByHosts(hostIDs []string) (map[string]models.SystemMetric, error) {
	latest := make(map[string]models.SystemMetric, len(hostIDs))
	if len(hostIDs) == 0 {
		return latest, nil
	}

	placeholders := strings.TrimRight(strings.Repeat("?,", len(hostIDs)), ",")
	args := make([]interface{}, len(hostIDs))
	for i, id := range hostIDs {
		args[i] = id
	}

	rows, err := DB.Query(`
		SELECT sm.id, sm.host_id, sm.cpu_usage, sm.mem_total, sm.mem_used, sm.mem_usage,
		       sm.disk_total, sm.disk_used, sm.disk_usage, sm.disk_read, sm.disk_write,
		       sm.net_in, sm.net_out, sm.created_at
		FROM system_metrics sm
		INNER JOIN (
			SELECT host_id, MAX(created_at) AS created_at
			FROM system_metrics
			WHERE host_id IN (`+placeholders+`)
			GROUP BY host_id
		) latest
			ON latest.host_id = sm.host_id AND latest.created_at = sm.created_at
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var m models.SystemMetric
		var ts time.Time
		if err := rows.Scan(&m.ID, &m.HostID, &m.CPUUsage, &m.MemTotal, &m.MemUsed, &m.MemUsage,
			&m.DiskTotal, &m.DiskUsed, &m.DiskUsage, &m.DiskRead, &m.DiskWrite,
			&m.NetIn, &m.NetOut, &ts); err != nil {
			return nil, err
		}
		m.CreatedAt = ts
		latest[m.HostID] = m
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return latest, nil
}

// GetLatestByHost returns the most recent metric for a host
func (r *SystemMetricRepository) GetLatestByHost(hostID string) (*models.SystemMetric, error) {
	var m models.SystemMetric
	var ts time.Time
	err := DB.QueryRow(`
		SELECT id, host_id, cpu_usage, mem_total, mem_used, mem_usage,
		       disk_total, disk_used, disk_usage, disk_read, disk_write,
		       net_in, net_out, created_at
		FROM system_metrics
		WHERE host_id = ?
		ORDER BY created_at DESC
		LIMIT 1
	`, hostID).Scan(&m.ID, &m.HostID, &m.CPUUsage, &m.MemTotal, &m.MemUsed, &m.MemUsage,
		&m.DiskTotal, &m.DiskUsed, &m.DiskUsage, &m.DiskRead, &m.DiskWrite,
		&m.NetIn, &m.NetOut, &ts)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	m.CreatedAt = ts
	return &m, nil
}

// DeleteOld deletes system metrics older than the specified duration
func (r *SystemMetricRepository) DeleteOld(retention time.Duration) (int64, error) {
	result, err := DB.Exec(`
		DELETE FROM system_metrics WHERE created_at < ?
	`, time.Now().Add(-retention))
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
