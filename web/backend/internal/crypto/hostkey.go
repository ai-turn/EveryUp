package crypto

import (
	"fmt"
	"log"
	"net"
	"os"
	"path/filepath"
	"sync"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"
)

var (
	knownHostsMu   sync.Mutex
	knownHostsPath string
)

// InitKnownHosts ensures the known_hosts file exists and returns its path.
func InitKnownHosts() string {
	knownHostsMu.Lock()
	defer knownHostsMu.Unlock()

	if knownHostsPath != "" {
		return knownHostsPath
	}

	dbPath := os.Getenv("EVERYUP_DATABASE_PATH")
	if dbPath == "" {
		dbPath = "./data/monitoring.db"
	}
	knownHostsPath = filepath.Join(filepath.Dir(dbPath), "known_hosts")

	// Ensure directory exists
	dir := filepath.Dir(knownHostsPath)
	os.MkdirAll(dir, 0700)

	// Create file if it doesn't exist
	if _, err := os.Stat(knownHostsPath); os.IsNotExist(err) {
		os.WriteFile(knownHostsPath, []byte{}, 0600)
	}

	return knownHostsPath
}

// HostKeyCallback returns an ssh.HostKeyCallback that uses Trust On First Use (TOFU).
// On first connection to a host, the key is saved to known_hosts.
// On subsequent connections, the key is verified against the stored entry.
// If the key has changed, the connection is rejected (potential MITM).
func HostKeyCallback() ssh.HostKeyCallback {
	path := InitKnownHosts()

	return func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		// Try to verify against existing known_hosts
		callback, err := knownhosts.New(path)
		if err != nil {
			log.Printf("[SSH] Warning: could not load known_hosts (%s): %v — accepting key (TOFU)", path, err)
			return addHostKey(path, hostname, remote, key)
		}

		err = callback(hostname, remote, key)
		if err == nil {
			return nil // Key matches
		}

		// Check if this is a "key not found" error (first connection)
		var keyErr *knownhosts.KeyError
		if isKeyNotFound(err, &keyErr) {
			log.Printf("[SSH] First connection to %s — storing host key (TOFU)", hostname)
			return addHostKey(path, hostname, remote, key)
		}

		// Key mismatch — potential MITM attack
		return fmt.Errorf("[SSH SECURITY] host key mismatch for %s — possible MITM attack. "+
			"Remove the old entry from %s if the host key was intentionally changed: %w",
			hostname, path, err)
	}
}

// isKeyNotFound checks whether the error indicates the host is unknown (no entry in known_hosts).
func isKeyNotFound(err error, keyErr **knownhosts.KeyError) bool {
	if ke, ok := err.(*knownhosts.KeyError); ok {
		*keyErr = ke
		// If Want is empty, the host was not found in known_hosts
		return len(ke.Want) == 0
	}
	return false
}

// addHostKey appends a new host key entry to the known_hosts file.
func addHostKey(path string, hostname string, remote net.Addr, key ssh.PublicKey) error {
	knownHostsMu.Lock()
	defer knownHostsMu.Unlock()

	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0600)
	if err != nil {
		return fmt.Errorf("failed to open known_hosts for writing: %w", err)
	}
	defer f.Close()

	// Use the remote address for the entry (host:port format)
	addr := hostname
	if remote != nil {
		addr = knownhosts.Normalize(remote.String())
	}

	line := knownhosts.Line([]string{addr}, key)
	if _, err := fmt.Fprintln(f, line); err != nil {
		return fmt.Errorf("failed to write host key: %w", err)
	}

	log.Printf("[SSH] Host key saved for %s in %s", addr, path)
	return nil
}
