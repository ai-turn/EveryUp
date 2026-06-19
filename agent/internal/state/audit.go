package state

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type AuditLogger struct {
	path string
	mu   sync.Mutex
}

type AuditEvent struct {
	Time        time.Time              `json:"time"`
	Type        string                 `json:"type"`
	ServiceName string                 `json:"serviceName,omitempty"`
	TargetKey   string                 `json:"targetKey,omitempty"`
	Message     string                 `json:"message,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

func NewAuditLogger(path string) *AuditLogger {
	return &AuditLogger{path: path}
}

func (l *AuditLogger) Append(event AuditEvent) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.path == "" {
		return nil
	}
	if event.Time.IsZero() {
		event.Time = time.Now()
	}

	if err := os.MkdirAll(filepath.Dir(l.path), 0o755); err != nil {
		return fmt.Errorf("create audit directory: %w", err)
	}

	file, err := os.OpenFile(l.path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open audit file: %w", err)
	}
	defer file.Close()

	encoded, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("encode audit event: %w", err)
	}
	if _, err := file.Write(append(encoded, '\n')); err != nil {
		return fmt.Errorf("write audit event: %w", err)
	}
	return nil
}
