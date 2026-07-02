package agent

import "sync"

// servicePIDIndex is a concurrency-safe host-PID -> service-name lookup,
// refreshed from Docker discovery each check cycle. The telemetry gateway reads
// it to attribute eBPF sidecar spans (which carry the instrumented process's
// host PID) to a service. It implements telemetrygateway.PIDResolver.
type servicePIDIndex struct {
	mu sync.RWMutex
	m  map[int]string
}

func newServicePIDIndex() *servicePIDIndex {
	return &servicePIDIndex{m: map[int]string{}}
}

func (x *servicePIDIndex) replace(m map[int]string) {
	x.mu.Lock()
	x.m = m
	x.mu.Unlock()
}

func (x *servicePIDIndex) ServiceNameByPID(pid int) (string, bool) {
	if pid <= 0 {
		return "", false
	}
	x.mu.RLock()
	defer x.mu.RUnlock()
	name, ok := x.m[pid]
	return name, ok
}
