package checker

import (
	"context"
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

	if err := ValidateHostForSSRF(config.Host); err != nil {
		result.Status = models.CheckStatusFailure
		result.ErrorMessage = fmt.Sprintf("TCP target blocked: %v", err)
		return result
	}

	// Attempt connection through the SSRF-safe dialer, which resolves again at
	// connect time to protect against DNS rebinding.
	startTime := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	conn, err := safeDialContext()(ctx, "tcp", address)
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
