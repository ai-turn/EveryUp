package watchdog

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Heartbeat struct {
	url    string
	token  string
	client *http.Client
}

func NewHeartbeat(url, token string, timeout time.Duration, client *http.Client) *Heartbeat {
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	if client == nil {
		client = &http.Client{Timeout: timeout}
	}
	return &Heartbeat{
		url:    strings.TrimSpace(url),
		token:  strings.TrimSpace(token),
		client: client,
	}
}

func (h *Heartbeat) Enabled() bool {
	return h != nil && h.url != ""
}

func (h *Heartbeat) Ping(ctx context.Context) error {
	if !h.Enabled() {
		return nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, h.url, nil)
	if err != nil {
		return fmt.Errorf("create heartbeat request: %w", err)
	}
	if h.token != "" {
		req.Header.Set("Authorization", "Bearer "+h.token)
	}
	resp, err := h.client.Do(req)
	if err != nil {
		return fmt.Errorf("send heartbeat: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if err != nil {
		return fmt.Errorf("read heartbeat response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("heartbeat returned %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

func (h *Heartbeat) Run(ctx context.Context, interval time.Duration, onError func(error)) {
	if !h.Enabled() {
		return
	}
	if interval <= 0 {
		interval = time.Minute
	}
	ping := func() {
		if err := h.Ping(ctx); err != nil && onError != nil {
			onError(err)
		}
	}
	ping()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			ping()
		}
	}
}
