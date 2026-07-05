package agent

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCopyTree(t *testing.T) {
	src := t.TempDir()
	dst := t.TempDir()

	if err := os.MkdirAll(filepath.Join(src, "node", "node_modules", "pkg"), 0o755); err != nil {
		t.Fatal(err)
	}
	files := map[string]string{
		"java/opentelemetry-javaagent.jar": "jar-bytes",
		"node/register.js":                 "console.log('hi')",
		"node/node_modules/pkg/index.js":   "module.exports = 1",
	}
	for rel, content := range files {
		if err := os.MkdirAll(filepath.Dir(filepath.Join(src, rel)), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(src, rel), []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	count, err := copyTree(src, dst)
	if err != nil {
		t.Fatalf("copyTree: %v", err)
	}
	if count != len(files) {
		t.Fatalf("copied %d files, want %d", count, len(files))
	}
	for rel, content := range files {
		got, err := os.ReadFile(filepath.Join(dst, rel))
		if err != nil || string(got) != content {
			t.Fatalf("dst %s = %q, %v", rel, got, err)
		}
	}

	// Re-copy overwrites without error (agent restarts).
	if _, err := copyTree(src, dst); err != nil {
		t.Fatalf("re-copy: %v", err)
	}
}
