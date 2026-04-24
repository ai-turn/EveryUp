package crypto

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// DefaultSSHKeyDirs lists the allowed directories for SSH key files.
// Paths outside these directories are rejected to prevent path traversal attacks.
var DefaultSSHKeyDirs = []string{
	"/app/ssh-keys",
	"/app/data/ssh-keys",
	"/root/.ssh",
	"/home",
}

// ValidateSSHKeyPath checks that the given SSH key file path is safe.
// It rejects paths that traverse outside the allowed directories to prevent
// arbitrary file reads (path traversal / LFI attacks).
func ValidateSSHKeyPath(keyPath string) error {
	if keyPath == "" {
		return fmt.Errorf("SSH key file path is required")
	}

	// Clean and resolve the path
	cleaned := filepath.Clean(keyPath)

	// Block relative paths — only absolute paths are allowed
	if !filepath.IsAbs(cleaned) {
		return fmt.Errorf("SSH key path must be an absolute path")
	}

	// Block obvious traversal patterns
	if strings.Contains(keyPath, "..") {
		return fmt.Errorf("SSH key path must not contain '..'")
	}

	// Check against allowed directories
	allowed := getAllowedSSHKeyDirs()
	for _, dir := range allowed {
		absDir := filepath.Clean(dir) + string(os.PathSeparator)
		if strings.HasPrefix(cleaned, absDir) || cleaned == filepath.Clean(dir) {
			return nil
		}
	}

	return fmt.Errorf("SSH key path must be within an allowed directory: %s", strings.Join(allowed, ", "))
}

// getAllowedSSHKeyDirs returns the list of directories that SSH key files are allowed in.
// It merges the defaults with any custom directories set via EVERYUP_SSH_KEY_DIRS env var.
func getAllowedSSHKeyDirs() []string {
	dirs := make([]string, len(DefaultSSHKeyDirs))
	copy(dirs, DefaultSSHKeyDirs)

	if custom := os.Getenv("EVERYUP_SSH_KEY_DIRS"); custom != "" {
		for _, d := range strings.Split(custom, ":") {
			d = strings.TrimSpace(d)
			if d != "" {
				dirs = append(dirs, d)
			}
		}
	}
	return dirs
}
