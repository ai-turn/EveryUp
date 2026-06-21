package webclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/aiturn/everyup/agent/internal/state"
)

type Client struct {
	baseURL string
	token   string
	client  *http.Client
}

type EnrollmentRequest struct {
	AgentName string `json:"agentName"`
	Mode      string `json:"mode"`
	Version   string `json:"version,omitempty"`
}

type EnrollmentResponse struct {
	AgentID string `json:"agentId"`
}

type EventRequest struct {
	AgentID string             `json:"agentId"`
	Events  []state.AuditEvent `json:"events"`
}

type ServiceSnapshotRequest struct {
	AgentID    string            `json:"agentId"`
	AgentName  string            `json:"agentName"`
	ObservedAt time.Time         `json:"observedAt"`
	Services   []ServiceSnapshot `json:"services"`
}

type ServiceSnapshot struct {
	Key         string    `json:"key"`
	Name        string    `json:"name"`
	CheckType   string    `json:"checkType"`
	Endpoint    string    `json:"endpoint"`
	Healthy     bool      `json:"healthy"`
	Seen        bool      `json:"seen"`
	Silenced    bool      `json:"silenced"`
	LastError   string    `json:"lastError,omitempty"`
	LastStatus  int       `json:"lastStatus,omitempty"`
	LastLatency string    `json:"lastLatency,omitempty"`
	UpdatedAt   time.Time `json:"updatedAt,omitempty"`
}

func New(baseURL, token string, timeout time.Duration, client *http.Client) *Client {
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	if client == nil {
		client = &http.Client{Timeout: timeout}
	}
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		token:   token,
		client:  client,
	}
}

func (c *Client) Enabled() bool {
	return c != nil && c.baseURL != "" && c.token != ""
}

func (c *Client) Enroll(ctx context.Context, req EnrollmentRequest) (EnrollmentResponse, error) {
	var out EnrollmentResponse
	if err := c.post(ctx, "/api/v1/agents/enroll", req, &out); err != nil {
		return EnrollmentResponse{}, err
	}
	if out.AgentID == "" {
		return EnrollmentResponse{}, fmt.Errorf("web enrollment response missing agentId")
	}
	return out, nil
}

func (c *Client) SendEvents(ctx context.Context, req EventRequest) error {
	if req.AgentID == "" {
		return fmt.Errorf("agentId is required")
	}
	if len(req.Events) == 0 {
		return nil
	}
	return c.post(ctx, fmt.Sprintf("/api/v1/agents/%s/events", url.PathEscape(req.AgentID)), req, nil)
}

type MetricsRequest struct {
	AgentID   string    `json:"agentId"`
	CPUUsage  float64   `json:"cpuUsage"`
	MemTotal  float64   `json:"memTotal"`
	MemUsed   float64   `json:"memUsed"`
	MemUsage  float64   `json:"memUsage"`
	DiskTotal float64   `json:"diskTotal"`
	DiskUsed  float64   `json:"diskUsed"`
	DiskUsage float64   `json:"diskUsage"`
	RecordedAt time.Time `json:"recordedAt"`
}

func (c *Client) SendMetrics(ctx context.Context, req MetricsRequest) error {
	if req.AgentID == "" {
		return fmt.Errorf("agentId is required")
	}
	return c.post(ctx, fmt.Sprintf("/api/v1/agents/%s/metrics", url.PathEscape(req.AgentID)), req, nil)
}

func (c *Client) SendServices(ctx context.Context, req ServiceSnapshotRequest) error {
	if req.AgentID == "" {
		return fmt.Errorf("agentId is required")
	}
	return c.post(ctx, fmt.Sprintf("/api/v1/agents/%s/services", url.PathEscape(req.AgentID)), req, nil)
}

func (c *Client) post(ctx context.Context, path string, payload interface{}, out interface{}) error {
	if !c.Enabled() {
		return fmt.Errorf("web client is not configured")
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("encode web request: %w", err)
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("create web request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.token)

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("send web request: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return fmt.Errorf("read web response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("web returned %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	if out != nil && len(body) > 0 {
		if err := json.Unmarshal(body, out); err != nil {
			return fmt.Errorf("decode web response: %w", err)
		}
	}
	return nil
}
