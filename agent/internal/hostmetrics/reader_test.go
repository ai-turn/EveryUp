package hostmetrics

import (
	"os"
	"path/filepath"
	"testing"
)

func TestReadCPUSample(t *testing.T) {
	path := filepath.Join(t.TempDir(), "stat")
	if err := os.WriteFile(path, []byte("cpu  10 0 30 60 5 0 0 0 0 0\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	sample, err := readCPUSample(path)
	if err != nil {
		t.Fatalf("readCPUSample returned error: %v", err)
	}
	if sample.idle != 65 || sample.total != 105 {
		t.Fatalf("sample = %+v", sample)
	}
}

func TestReadNetSample(t *testing.T) {
	path := filepath.Join(t.TempDir(), "dev")
	content := "Inter-|   Receive                                                |  Transmit\n" +
		" face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed\n" +
		"    lo: 1000 1 0 0 0 0 0 0 2000 1 0 0 0 0 0 0\n" +
		"  eth0: 500 5 0 0 0 0 0 0 700 7 0 0 0 0 0 0\n" +
		"  eth1: 100 1 0 0 0 0 0 0 300 3 0 0 0 0 0 0\n"
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	sample, err := readNetSample(path)
	if err != nil {
		t.Fatalf("readNetSample returned error: %v", err)
	}
	// lo excluded; eth0+eth1: rx=600, tx=1000.
	if sample.rxBytes != 600 || sample.txBytes != 1000 {
		t.Fatalf("sample = %+v", sample)
	}
}

func TestReadMemInfo(t *testing.T) {
	path := filepath.Join(t.TempDir(), "meminfo")
	content := "MemTotal:       1000 kB\nMemAvailable:    250 kB\n"
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	total, available, err := readMemInfo(path)
	if err != nil {
		t.Fatalf("readMemInfo returned error: %v", err)
	}
	if total != 1024000 || available != 256000 {
		t.Fatalf("total=%d available=%d", total, available)
	}
}
