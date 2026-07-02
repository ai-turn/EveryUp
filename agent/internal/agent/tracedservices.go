package agent

import (
	"sync"
	"time"
)

// tracedServices remembers services that recently shipped real OTLP spans
// through the telemetry gateway, so the access-log path can stop emitting
// synthetic SERVER spans for them — real spans and synthetic spans for the same
// service would double-count every request. The TTL makes suppression
// self-healing: if real spans stop (app instrumentation removed, eBPF sidecar
// stopped), synthetic spans resume after the window. It implements
// telemetrygateway.TraceObserver.
type tracedServices struct {
	mu  sync.Mutex
	m   map[string]time.Time
	ttl time.Duration
}

func newTracedServices(ttl time.Duration) *tracedServices {
	return &tracedServices{m: map[string]time.Time{}, ttl: ttl}
}

func (t *tracedServices) MarkTraced(service string) {
	if service == "" {
		return
	}
	t.mu.Lock()
	t.m[service] = time.Now()
	t.mu.Unlock()
}

func (t *tracedServices) isTraced(service string) bool {
	return t.isTracedAt(service, time.Now())
}

func (t *tracedServices) isTracedAt(service string, now time.Time) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	at, ok := t.m[service]
	if !ok {
		return false
	}
	if now.Sub(at) > t.ttl {
		delete(t.m, service)
		return false
	}
	return true
}
