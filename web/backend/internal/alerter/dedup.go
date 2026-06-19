package alerter

import (
	"crypto/sha256"
	"fmt"
	"sync"
	"time"
)

// Deduplicator prevents duplicate alert notifications within a cooldown window
type Deduplicator struct {
	mu          sync.Mutex
	lastAlerted map[string]time.Time
	cooldown    time.Duration
}

// NewDeduplicator creates a new deduplicator with the given cooldown duration
func NewDeduplicator(cooldown time.Duration) *Deduplicator {
	d := &Deduplicator{
		lastAlerted: make(map[string]time.Time),
		cooldown:    cooldown,
	}
	// Start cleanup goroutine
	go d.cleanup()
	return d
}

// ShouldAlert returns true if an alert should be sent for the given fingerprint
func (d *Deduplicator) ShouldAlert(fingerprint string) bool {
	d.mu.Lock()
	defer d.mu.Unlock()

	last, exists := d.lastAlerted[fingerprint]
	if exists && time.Since(last) < d.cooldown {
		return false
	}
	d.lastAlerted[fingerprint] = time.Now()
	return true
}

// GenerateFingerprint creates a fingerprint from serviceId + level + message
func GenerateFingerprint(serviceID, level, message string) string {
	h := sha256.Sum256([]byte(fmt.Sprintf("%s:%s:%s", serviceID, level, message)))
	return fmt.Sprintf("%x", h[:8])
}

// cleanup periodically removes expired entries
func (d *Deduplicator) cleanup() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		d.mu.Lock()
		now := time.Now()
		for fp, t := range d.lastAlerted {
			if now.Sub(t) > d.cooldown*2 {
				delete(d.lastAlerted, fp)
			}
		}
		d.mu.Unlock()
	}
}
