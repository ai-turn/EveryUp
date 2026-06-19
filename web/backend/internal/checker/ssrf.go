package checker

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"strings"
)

// privateIPRanges contains CIDR ranges that should be blocked to prevent SSRF.
// This includes loopback, private networks, link-local, and cloud metadata endpoints.
var privateIPRanges []*net.IPNet

func init() {
	cidrs := []string{
		"127.0.0.0/8",    // IPv4 loopback
		"10.0.0.0/8",     // RFC 1918 Class A
		"172.16.0.0/12",  // RFC 1918 Class B
		"192.168.0.0/16", // RFC 1918 Class C
		"169.254.0.0/16", // Link-local / AWS metadata
		"0.0.0.0/8",      // "This" network
		"100.64.0.0/10",  // Carrier-grade NAT (RFC 6598)
		"192.0.0.0/24",   // IETF protocol assignments
		"192.0.2.0/24",   // TEST-NET-1
		"198.51.100.0/24", // TEST-NET-2
		"203.0.113.0/24", // TEST-NET-3
		"::1/128",        // IPv6 loopback
		"fc00::/7",       // IPv6 unique local
		"fe80::/10",      // IPv6 link-local
	}
	for _, cidr := range cidrs {
		_, network, err := net.ParseCIDR(cidr)
		if err == nil {
			privateIPRanges = append(privateIPRanges, network)
		}
	}
}

// isPrivateIP checks if an IP address falls within any blocked range.
func isPrivateIP(ip net.IP) bool {
	for _, network := range privateIPRanges {
		if network.Contains(ip) {
			return true
		}
	}
	return false
}

// ValidateURLForSSRF checks that a URL is safe from SSRF attacks.
// It validates the scheme and resolves the hostname to check for private IPs.
func ValidateURLForSSRF(rawURL string) error {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}

	// Only allow http and https schemes
	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return fmt.Errorf("URL scheme '%s' is not allowed (only http/https)", parsed.Scheme)
	}

	hostname := parsed.Hostname()
	if hostname == "" {
		return fmt.Errorf("URL must have a hostname")
	}

	// Resolve hostname to IP addresses
	ips, err := net.DefaultResolver.LookupIPAddr(context.Background(), hostname)
	if err != nil {
		return fmt.Errorf("failed to resolve hostname '%s': %w", hostname, err)
	}

	// Check all resolved IPs against private ranges
	for _, ipAddr := range ips {
		if isPrivateIP(ipAddr.IP) {
			return fmt.Errorf("URL resolves to private/internal IP address (%s) — request blocked for security", ipAddr.IP.String())
		}
	}

	return nil
}

// safeDialContext returns a DialContext function that blocks connections to private IPs.
// This protects against DNS rebinding attacks by checking the resolved IP at dial time.
func safeDialContext() func(ctx context.Context, network, addr string) (net.Conn, error) {
	dialer := &net.Dialer{}
	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(addr)
		if err != nil {
			return nil, fmt.Errorf("invalid address: %w", err)
		}

		// Resolve the hostname
		ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
		if err != nil {
			return nil, fmt.Errorf("DNS resolution failed: %w", err)
		}

		// Check all resolved IPs
		for _, ip := range ips {
			if isPrivateIP(ip.IP) {
				return nil, fmt.Errorf("connection to private IP %s blocked (SSRF protection)", ip.IP.String())
			}
		}

		// Use the first resolved IP to connect
		if len(ips) == 0 {
			return nil, fmt.Errorf("no IP addresses found for %s", host)
		}
		safeAddr := net.JoinHostPort(ips[0].IP.String(), port)
		return dialer.DialContext(ctx, network, safeAddr)
	}
}
