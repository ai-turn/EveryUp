package handlers

import (
	"regexp"
	"strings"
)

var (
	reNumeric = regexp.MustCompile(`^[0-9]+$`)
	reUUID    = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
	reLongHex = regexp.MustCompile(`^[0-9a-zA-Z]{16,}$`)
)

// NormalizePath replaces numeric IDs and UUIDs in URL path segments with ":id".
// Query strings are stripped.
func NormalizePath(raw string) string {
	if raw == "" {
		return ""
	}

	// Strip query string
	if idx := strings.IndexByte(raw, '?'); idx != -1 {
		raw = raw[:idx]
	}

	if raw == "/" {
		return "/"
	}

	parts := strings.Split(raw, "/")
	for i, seg := range parts {
		if seg == "" {
			continue
		}
		// Already a placeholder like :id or :name
		if strings.HasPrefix(seg, ":") {
			continue
		}
		if reNumeric.MatchString(seg) || reUUID.MatchString(seg) || reLongHex.MatchString(seg) {
			parts[i] = ":id"
		}
	}

	return strings.Join(parts, "/")
}
