package agent

import (
	"io"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strings"
)

// syncInstrumentationVolume copies the app-instrumentation bundle shipped in
// the agent image (OTel Java agent jar, Node register bundle) into the shared
// volume, so app containers can mount it read-only and load it via
// JAVA_TOOL_OPTIONS / NODE_OPTIONS without installing anything.
//
// A missing destination directory means no volume is mounted — the feature is
// simply off. Best-effort: failures are logged, never fatal.
// ponytail: unconditional overwrite each start (~100MB, restarts are rare);
// add a version-marker skip if startup time ever matters.
func (a *Agent) syncInstrumentationVolume() {
	src := a.cfg.InstrumentationSrcDir
	dst := a.cfg.InstrumentationDir
	if src == "" || dst == "" {
		return
	}
	if info, err := os.Stat(dst); err != nil || !info.IsDir() {
		return
	}
	// The image ships dst as an (owned, empty) directory so a named volume
	// inherits writable ownership — an actual mount is what turns the feature
	// on. Without this check every start would copy ~100MB into the
	// container's own writable layer.
	if !isMountPoint(dst) {
		return
	}
	if info, err := os.Stat(src); err != nil || !info.IsDir() {
		return
	}

	files, err := copyTree(src, dst)
	if err != nil {
		log.Printf("instrumentation bundle sync failed: %v", err)
		return
	}
	log.Printf("instrumentation bundle synced to %s: files=%d", dst, files)
	a.auditEvent("instrumentation_synced", a.cfg.ServiceName, "", "app instrumentation bundle copied to shared volume", map[string]interface{}{
		"path":  dst,
		"files": files,
	})
}

// isMountPoint reports whether path is a mount point per /proc/self/mountinfo.
// When mountinfo is unavailable (non-Linux) it errs on "mounted" so the copy
// still happens.
func isMountPoint(path string) bool {
	data, err := os.ReadFile("/proc/self/mountinfo")
	if err != nil {
		return true
	}
	clean := strings.TrimSuffix(path, "/")
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		// mountinfo: id parent major:minor root MOUNTPOINT options...
		if len(fields) >= 5 && fields[4] == clean {
			return true
		}
	}
	return false
}

func copyTree(src, dst string) (int, error) {
	count := 0
	err := filepath.WalkDir(src, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dst, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		if !d.Type().IsRegular() {
			return nil
		}
		if err := copyFile(path, target); err != nil {
			return err
		}
		count++
		return nil
	})
	return count, err
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}
