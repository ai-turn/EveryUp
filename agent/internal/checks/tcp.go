package checks

import (
	"context"
	"net"
	"time"
)

type TCPChecker struct {
	timeout time.Duration
}

type TCPResult struct {
	Address string
	Latency time.Duration
	Healthy bool
	Error   string
}

func NewTCPChecker(timeout time.Duration) *TCPChecker {
	return &TCPChecker{timeout: timeout}
}

func (c *TCPChecker) Check(ctx context.Context, address string) TCPResult {
	start := time.Now()
	var dialer net.Dialer
	if c.timeout > 0 {
		dialer.Timeout = c.timeout
	}

	conn, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return TCPResult{Address: address, Latency: time.Since(start), Error: err.Error()}
	}
	_ = conn.Close()

	return TCPResult{
		Address: address,
		Latency: time.Since(start),
		Healthy: true,
	}
}
