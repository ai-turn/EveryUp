package checks

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

type HTTPChecker struct {
	client *http.Client
}

type HTTPResult struct {
	URL        string
	StatusCode int
	Latency    time.Duration
	Healthy    bool
	Error      string
}

func NewHTTPChecker(timeout time.Duration) *HTTPChecker {
	return &HTTPChecker{
		client: &http.Client{Timeout: timeout},
	}
}

func (c *HTTPChecker) Check(ctx context.Context, targetURL string) HTTPResult {
	start := time.Now()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return HTTPResult{URL: targetURL, Latency: time.Since(start), Error: err.Error()}
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return HTTPResult{URL: targetURL, Latency: time.Since(start), Error: err.Error()}
	}
	defer resp.Body.Close()

	healthy := resp.StatusCode >= 200 && resp.StatusCode < 400
	result := HTTPResult{
		URL:        targetURL,
		StatusCode: resp.StatusCode,
		Latency:    time.Since(start),
		Healthy:    healthy,
	}
	if !healthy {
		result.Error = fmt.Sprintf("unexpected status code %d", resp.StatusCode)
	}
	return result
}
