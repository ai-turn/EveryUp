package agent

import (
	"os"
	"path/filepath"
	"testing"
)

// The eBPF sidecar stamps spans with the serving OS thread's TID; the index
// holds TGIDs from docker top. A TID lookup must resolve through
// /proc/<tid>/status Tgid to the owning process.
func TestServicePIDIndexResolvesTIDToTGID(t *testing.T) {
	root := t.TempDir()
	statusDir := filepath.Join(root, "proc", "3731")
	if err := os.MkdirAll(statusDir, 0o755); err != nil {
		t.Fatal(err)
	}
	status := "Name:\twhoami\nUmask:\t0022\nState:\tS (sleeping)\nTgid:\t3335\nNgid:\t0\nPid:\t3731\n"
	if err := os.WriteFile(filepath.Join(statusDir, "status"), []byte(status), 0o644); err != nil {
		t.Fatal(err)
	}

	idx := newServicePIDIndex(root)
	idx.replace(map[int]string{3335: "whoami"})

	if name, ok := idx.ServiceNameByPID(3335); !ok || name != "whoami" {
		t.Fatalf("direct TGID lookup = %q,%v", name, ok)
	}
	if name, ok := idx.ServiceNameByPID(3731); !ok || name != "whoami" {
		t.Fatalf("TID fallback lookup = %q,%v — want whoami via Tgid", name, ok)
	}
	if _, ok := idx.ServiceNameByPID(9999); ok {
		t.Fatal("unknown pid with no /proc entry must miss")
	}
}
