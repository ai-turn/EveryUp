package checker

import (
	"fmt"
	"net"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// TCPChecker performs TCP port health checks
type TCPChecker struct{}

// NewTCPChecker creates a new TCP checker
func NewTCPChecker() *TCPChecker {
	return &TCPChecker{}
}

// Check performs a TCP port check
func (c *TCPChecker) Check(config *models.TCPConfig) *CheckResult {
	result := &CheckResult{
		CheckedAt: time.Now(),
	}

	address := net.JoinHostPort(config.Host, fmt.Sprintf("%d", config.Port))
	timeout := time.Duration(config.Timeout) * time.Millisecond

	// Attempt connection
	startTime := time.Now()
	conn, err := net.DialTimeout("tcp", address, timeout)
	result.ResponseTime = int(time.Since(startTime).Milliseconds())

	if err != nil {
		result.Status = models.CheckStatusFailure
		result.ErrorMessage = fmt.Sprintf("TCP connection failed: %v", err)
		return result
	}

	conn.Close()
	result.Status = models.CheckStatusSuccess
	return result
}
