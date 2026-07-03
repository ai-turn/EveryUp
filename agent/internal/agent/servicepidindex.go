package agent

import (
	"os"
	"strconv"
	"strings"
	"sync"
)

// servicePIDIndex is a concurrency-safe host-PID -> service-name lookup,
// refreshed from Docker discovery each check cycle. The telemetry gateway reads
// it to attribute eBPF sidecar spans to a service. It implements
// telemetrygateway.PIDResolver.
//
// The index holds process IDs (TGIDs, what docker top reports), but the
// sidecar stamps spans with the OS thread that served the request — for Go
// binaries that is an arbitrary TID, not the TGID. On a lookup miss the TID is
// resolved to its TGID via /proc/<tid>/status and retried.
type servicePIDIndex struct {
	mu sync.RWMutex
	m  map[int]string
	// procRoot prefixes /proc reads ("/hostfs" when host / is mounted there,
	// "" when running directly on the host).
	procRoot string
}

func newServicePIDIndex(procRoot string) *servicePIDIndex {
	return &servicePIDIndex{m: map[int]string{}, procRoot: strings.TrimSuffix(procRoot, "/")}
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
	name, ok := x.m[pid]
	x.mu.RUnlock()
	if ok {
		return name, true
	}
	// ponytail: one /proc read per unresolved span batch; cache TID->TGID if
	// gateway volume ever makes this hot.
	tgid := x.tgidOf(pid)
	if tgid <= 0 || tgid == pid {
		return "", false
	}
	x.mu.RLock()
	defer x.mu.RUnlock()
	name, ok = x.m[tgid]
	return name, ok
}

// tgidOf reads the thread-group id (process id) a thread belongs to.
func (x *servicePIDIndex) tgidOf(tid int) int {
	data, err := os.ReadFile(x.procRoot + "/proc/" + strconv.Itoa(tid) + "/status")
	if err != nil {
		return 0
	}
	for _, line := range strings.Split(string(data), "\n") {
		if rest, ok := strings.CutPrefix(line, "Tgid:"); ok {
			tgid, err := strconv.Atoi(strings.TrimSpace(rest))
			if err != nil {
				return 0
			}
			return tgid
		}
	}
	return 0
}
