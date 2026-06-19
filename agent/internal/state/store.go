package state

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type TargetState struct {
	LastAlertAt         time.Time `json:"lastAlertAt,omitempty"`
	LastLogAlertAt      time.Time `json:"lastLogAlertAt,omitempty"`
	LastResourceAlertAt time.Time `json:"lastResourceAlertAt,omitempty"`
	LastHostAlertAt     time.Time `json:"lastHostAlertAt,omitempty"`
	WasHealthy          bool      `json:"wasHealthy"`
	SeenResult          bool      `json:"seenResult"`
	UpdatedAt           time.Time `json:"updatedAt"`
}

type Snapshot struct {
	Version  int                    `json:"version"`
	Targets  map[string]TargetState `json:"targets"`
	Silences map[string]Silence     `json:"silences,omitempty"`
	Actions  map[string]Action      `json:"actions,omitempty"`
}

type Silence struct {
	Until     time.Time `json:"until"`
	Reason    string    `json:"reason,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

type Action struct {
	Token       string    `json:"token"`
	Type        string    `json:"type"`
	ServiceKey  string    `json:"serviceKey"`
	ServiceName string    `json:"serviceName"`
	Status      string    `json:"status"`
	DryRun      bool      `json:"dryRun"`
	RequestedBy string    `json:"requestedBy,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	ExpiresAt   time.Time `json:"expiresAt"`
	ConfirmedAt time.Time `json:"confirmedAt,omitempty"`
	Message     string    `json:"message,omitempty"`
}

type Store struct {
	path string
	mu   sync.Mutex
}

func NewStore(path string) *Store {
	return &Store{path: path}
}

func (s *Store) Load() (Snapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.path == "" {
		return emptySnapshot(), nil
	}

	data, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return emptySnapshot(), nil
	}
	if err != nil {
		return Snapshot{}, fmt.Errorf("read state file: %w", err)
	}
	if len(data) == 0 {
		return emptySnapshot(), nil
	}

	var snapshot Snapshot
	if err := json.Unmarshal(data, &snapshot); err != nil {
		return Snapshot{}, fmt.Errorf("decode state file: %w", err)
	}
	if snapshot.Targets == nil {
		snapshot.Targets = make(map[string]TargetState)
	}
	if snapshot.Silences == nil {
		snapshot.Silences = make(map[string]Silence)
	}
	if snapshot.Actions == nil {
		snapshot.Actions = make(map[string]Action)
	}
	if snapshot.Version == 0 {
		snapshot.Version = 1
	}
	return snapshot, nil
}

func (s *Store) Save(snapshot Snapshot) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.path == "" {
		return nil
	}

	if snapshot.Version == 0 {
		snapshot.Version = 1
	}
	if snapshot.Targets == nil {
		snapshot.Targets = make(map[string]TargetState)
	}
	if snapshot.Silences == nil {
		snapshot.Silences = make(map[string]Silence)
	}
	if snapshot.Actions == nil {
		snapshot.Actions = make(map[string]Action)
	}

	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return fmt.Errorf("create state directory: %w", err)
	}

	data, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		return fmt.Errorf("encode state file: %w", err)
	}

	tmp, err := os.CreateTemp(filepath.Dir(s.path), filepath.Base(s.path)+".*.tmp")
	if err != nil {
		return fmt.Errorf("create temp state file: %w", err)
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)

	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("write temp state file: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close temp state file: %w", err)
	}
	if err := os.Rename(tmpName, s.path); err != nil {
		if removeErr := os.Remove(s.path); removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
			return fmt.Errorf("replace state file: %w", err)
		}
		if retryErr := os.Rename(tmpName, s.path); retryErr != nil {
			return fmt.Errorf("replace state file: %w", retryErr)
		}
	}
	return nil
}

func emptySnapshot() Snapshot {
	return Snapshot{
		Version:  1,
		Targets:  make(map[string]TargetState),
		Silences: make(map[string]Silence),
		Actions:  make(map[string]Action),
	}
}
