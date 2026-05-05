package collector

import (
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"

	"github.com/aiturn/everyup/internal/collector/parser"
	"github.com/aiturn/everyup/internal/config"
	"github.com/aiturn/everyup/internal/crypto"
	"github.com/aiturn/everyup/internal/models"
)

// Compile-time check that SSHCollector implements MetricCollector.
var _ MetricCollector = (*SSHCollector)(nil)

// combinedCommand is a single SSH command that fetches all metrics at once.
const combinedCommand = `echo "===STAT===" && head -1 /proc/stat && echo "===MEMINFO===" && cat /proc/meminfo && echo "===DF===" && df -B1 / && echo "===DISKSTATS===" && cat /proc/diskstats && echo "===NETDEV===" && cat /proc/net/dev && echo "===UPTIME===" && cat /proc/uptime && echo "===HOSTNAME===" && hostname && echo "===OSRELEASE===" && cat /etc/os-release 2>/dev/null || true && echo "===KERNEL===" && uname -r && echo "===END==="`

// processCommand fetches the top N processes sorted by CPU.
const processCommand = `ps aux --sort=-%cpu | head -%d`

// SSHCollector collects metrics from a remote Linux host via SSH.
type SSHCollector struct {
	host   *models.Host
	client *ssh.Client
	mu     sync.Mutex

	// Previous snapshots for delta calculation
	prevCPU     *parser.CPURaw
	prevDiskIO  *parser.DiskIORaw
	prevNetwork *parser.NetworkRaw
	prevTime    time.Time

	// SSH config
	sshConfig  *ssh.ClientConfig
	timeout    time.Duration
	cmdTimeout time.Duration
}

// NewSSHCollector creates a new SSH collector for the given host.
func NewSSHCollector(host *models.Host) (*SSHCollector, error) {
	authMethods, err := buildSSHAuth(host)
	if err != nil {
		return nil, fmt.Errorf("SSH auth config failed for %s: %w", host.ID, err)
	}

	cfg := config.Get()
	connTimeout := 10 * time.Second
	cmdTimeout := 5 * time.Second
	if cfg != nil {
		if cfg.System.SSH.ConnectionTimeout > 0 {
			connTimeout = time.Duration(cfg.System.SSH.ConnectionTimeout) * time.Second
		}
		if cfg.System.SSH.CommandTimeout > 0 {
			cmdTimeout = time.Duration(cfg.System.SSH.CommandTimeout) * time.Second
		}
	}

	sshConfig := &ssh.ClientConfig{
		User:            host.SSHUser,
		Auth:            authMethods,
		HostKeyCallback: crypto.HostKeyCallback(),
		Timeout:         connTimeout,
	}

	return &SSHCollector{
		host:       host,
		sshConfig:  sshConfig,
		timeout:    connTimeout,
		cmdTimeout: cmdTimeout,
	}, nil
}

// HostID returns the host identifier.
func (c *SSHCollector) HostID() string {
	return c.host.ID
}

// Close closes the SSH connection.
func (c *SSHCollector) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.client != nil {
		err := c.client.Close()
		c.client = nil
		return err
	}
	return nil
}

// Collect gathers a single snapshot of system metrics via SSH.
func (c *SSHCollector) Collect() (*models.SystemMetric, error) {
	output, err := c.runCommand(combinedCommand)
	if err != nil {
		return nil, fmt.Errorf("collect failed for %s: %w", c.host.ID, err)
	}

	now := time.Now()
	sections := parseSections(output)

	// CPU (delta-based)
	cpuRaw, err := parser.ParseCPU(sections["STAT"])
	if err != nil {
		return nil, fmt.Errorf("CPU parse failed: %w", err)
	}
	var cpuUsage float64
	if c.prevCPU != nil {
		cpuUsage = parser.CalculateCPUUsage(c.prevCPU, cpuRaw)
	}
	c.prevCPU = cpuRaw

	// Memory
	memInfo, err := parser.ParseMemory(sections["MEMINFO"])
	if err != nil {
		return nil, fmt.Errorf("memory parse failed: %w", err)
	}

	// Disk usage
	diskUsage, err := parser.ParseDiskUsage(sections["DF"])
	if err != nil {
		log.Printf("Disk usage parse failed for %s: %v", c.host.ID, err)
		diskUsage = &parser.DiskUsageInfo{}
	}

	// Disk I/O (delta-based)
	diskIORaw, _ := parser.ParseDiskIO(sections["DISKSTATS"])
	var diskReadMBps, diskWriteMBps float64
	if c.prevDiskIO != nil && !c.prevTime.IsZero() {
		elapsed := now.Sub(c.prevTime).Seconds()
		diskReadMBps, diskWriteMBps = parser.CalculateDiskIO(c.prevDiskIO, diskIORaw, elapsed)
	}
	c.prevDiskIO = diskIORaw

	// Network (delta-based)
	netRaw, _ := parser.ParseNetwork(sections["NETDEV"])
	var netInMBps, netOutMBps float64
	if c.prevNetwork != nil && !c.prevTime.IsZero() {
		elapsed := now.Sub(c.prevTime).Seconds()
		netInMBps, netOutMBps = parser.CalculateNetworkIO(c.prevNetwork, netRaw, elapsed)
	}
	c.prevNetwork = netRaw

	c.prevTime = now

	return &models.SystemMetric{
		HostID:    c.host.ID,
		CPUUsage:  cpuUsage,
		MemTotal:  memInfo.TotalGB,
		MemUsed:   memInfo.UsedGB,
		MemUsage:  memInfo.UsagePercent,
		DiskTotal: diskUsage.TotalGB,
		DiskUsed:  diskUsage.UsedGB,
		DiskUsage: diskUsage.UsagePercent,
		DiskRead:  diskReadMBps,
		DiskWrite: diskWriteMBps,
		NetIn:     netInMBps,
		NetOut:    netOutMBps,
		CreatedAt: now,
	}, nil
}

// GetSystemInfo returns host information with the current resource snapshot.
func (c *SSHCollector) GetSystemInfo() (*models.SystemInfo, error) {
	output, err := c.runCommand(combinedCommand)
	if err != nil {
		return nil, err
	}

	sections := parseSections(output)

	memInfo, _ := parser.ParseMemory(sections["MEMINFO"])
	diskUsage, _ := parser.ParseDiskUsage(sections["DF"])
	uptime := parser.ParseUptime(sections["UPTIME"])
	hostname := parser.ParseHostname(sections["HOSTNAME"])
	osName := parsePrettyName(sections["OSRELEASE"])
	kernel := strings.TrimSpace(sections["KERNEL"])
	if osName == "" {
		osName = "linux"
	}

	// CPU: return 0 for info (actual usage comes from Collect delta)
	info := &models.SystemInfo{
		Hostname: hostname,
		OS:       osName,
		Platform: "linux",
		Kernel:   kernel,
		Uptime:   uptime,
		IP:       c.host.IP,
		CPU:      models.CPUInfo{Usage: 0},
	}

	if memInfo != nil {
		info.Memory = models.MemInfo{
			Total: memInfo.TotalGB,
			Used:  memInfo.UsedGB,
			Usage: memInfo.UsagePercent,
		}
	}
	if diskUsage != nil {
		info.Disk = models.DiskInfo{
			Total: diskUsage.TotalGB,
			Used:  diskUsage.UsedGB,
			Usage: diskUsage.UsagePercent,
		}
	}

	return info, nil
}

// GetProcesses returns the top N processes from the remote host.
func (c *SSHCollector) GetProcesses(limit int, sortBy string) ([]models.ProcessInfo, error) {
	if limit <= 0 {
		limit = 10
	}
	sort := "-%cpu"
	if sortBy == "memory" {
		sort = "-%mem"
	}
	cmd := fmt.Sprintf("ps aux --sort=%s | head -%d", sort, limit+1)
	output, err := c.runCommand(cmd)
	if err != nil {
		return nil, fmt.Errorf("process list failed: %w", err)
	}

	parsed := parser.ParseProcesses(output, limit)
	var result []models.ProcessInfo
	for _, p := range parsed {
		result = append(result, models.ProcessInfo{
			PID:         p.PID,
			Name:        p.Name,
			CPU:         p.CPU,
			Memory:      p.Memory,
			MemoryBytes: p.MemKB * 1024,
			Status:      p.Status,
		})
	}
	return result, nil
}

// ensureConnected maintains a persistent SSH connection with keep-alive.
func (c *SSHCollector) ensureConnected() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.client != nil {
		// Test if connection is still alive
		_, _, err := c.client.SendRequest("keepalive@openssh.com", true, nil)
		if err == nil {
			return nil
		}
		// Connection dead — close and reconnect
		c.client.Close()
		c.client = nil
	}

	sshPort := c.host.SSHPort
	if sshPort == 0 {
		sshPort = 22
	}
	addr := fmt.Sprintf("%s:%d", c.host.IP, sshPort)

	client, err := ssh.Dial("tcp", addr, c.sshConfig)
	if err != nil {
		return fmt.Errorf("SSH dial failed (%s): %w", addr, err)
	}

	c.client = client
	log.Printf("SSH connected to %s (%s)", c.host.ID, addr)
	return nil
}

// runCommand executes a command on the remote host via SSH.
// It reuses the persistent connection and creates a new session per call.
func (c *SSHCollector) runCommand(cmd string) (string, error) {
	if err := c.ensureConnected(); err != nil {
		return "", err
	}

	c.mu.Lock()
	client := c.client
	c.mu.Unlock()

	session, err := client.NewSession()
	if err != nil {
		// Session creation failed — connection might be broken
		c.mu.Lock()
		c.client.Close()
		c.client = nil
		c.mu.Unlock()
		return "", fmt.Errorf("SSH session failed: %w", err)
	}
	defer session.Close()

	output, err := session.CombinedOutput(cmd)
	if err != nil {
		return "", fmt.Errorf("SSH command failed: %w", err)
	}

	return string(output), nil
}

// parseSections splits the combined command output into named sections.
func parseSections(output string) map[string]string {
	sections := make(map[string]string)
	var currentKey string
	var currentLines []string

	for _, line := range strings.Split(output, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "===") && strings.HasSuffix(trimmed, "===") {
			// Save previous section
			if currentKey != "" {
				sections[currentKey] = strings.Join(currentLines, "\n")
			}
			// Start new section
			currentKey = strings.Trim(trimmed, "= ")
			currentLines = nil
		} else if currentKey != "" && trimmed != "" {
			currentLines = append(currentLines, line)
		}
	}
	// Save last section
	if currentKey != "" && currentKey != "END" {
		sections[currentKey] = strings.Join(currentLines, "\n")
	}

	return sections
}

func parsePrettyName(osRelease string) string {
	for _, line := range strings.Split(osRelease, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "PRETTY_NAME=") {
			continue
		}
		value := strings.TrimPrefix(line, "PRETTY_NAME=")
		return strings.Trim(value, `"'`)
	}
	return ""
}

// buildSSHAuth creates SSH auth methods from a host model.
func buildSSHAuth(host *models.Host) ([]ssh.AuthMethod, error) {
	switch host.SSHAuthType {
	case models.SSHAuthPassword:
		if host.SSHPassword == "" {
			return nil, fmt.Errorf("SSH password not configured")
		}
		return []ssh.AuthMethod{ssh.Password(host.SSHPassword)}, nil

	case models.SSHAuthKey:
		if host.SSHKey == "" {
			return nil, fmt.Errorf("SSH key content not configured")
		}
		signer, err := ssh.ParsePrivateKey([]byte(host.SSHKey))
		if err != nil {
			return nil, fmt.Errorf("failed to parse SSH key: %w", err)
		}
		return []ssh.AuthMethod{ssh.PublicKeys(signer)}, nil

	case models.SSHAuthKeyFile:
		if host.SSHKeyPath == "" {
			return nil, fmt.Errorf("SSH key file path not configured")
		}
		if err := crypto.ValidateSSHKeyPath(host.SSHKeyPath); err != nil {
			return nil, fmt.Errorf("invalid SSH key path: %w", err)
		}
		keyBytes, err := os.ReadFile(host.SSHKeyPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read SSH key file: %w", err)
		}
		signer, err := ssh.ParsePrivateKey(keyBytes)
		if err != nil {
			return nil, fmt.Errorf("failed to parse SSH key file: %w", err)
		}
		return []ssh.AuthMethod{ssh.PublicKeys(signer)}, nil

	default:
		if host.SSHPassword != "" {
			return []ssh.AuthMethod{ssh.Password(host.SSHPassword)}, nil
		}
		return nil, fmt.Errorf("no SSH auth method configured for host %s", host.ID)
	}
}
