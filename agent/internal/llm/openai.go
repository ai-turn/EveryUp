package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type OpenAICompatible struct {
	baseURL   string
	apiKey    string
	model     string
	timeout   time.Duration
	maxTokens int
	client    *http.Client
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	Temperature float64       `json:"temperature"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
}

type chatResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func NewOpenAICompatible(baseURL, apiKey, model string, timeout time.Duration, maxTokens int, client *http.Client) *OpenAICompatible {
	if timeout <= 0 {
		timeout = 8 * time.Second
	}
	if maxTokens <= 0 {
		maxTokens = 500
	}
	if client == nil {
		client = &http.Client{Timeout: timeout}
	}
	return &OpenAICompatible{
		baseURL:   strings.TrimRight(baseURL, "/"),
		apiKey:    apiKey,
		model:     model,
		timeout:   timeout,
		maxTokens: maxTokens,
		client:    client,
	}
}

func (p *OpenAICompatible) Enabled() bool {
	return p != nil && p.baseURL != "" && p.model != ""
}

func (p *OpenAICompatible) Summarize(ctx context.Context, incident IncidentContext) (Summary, error) {
	if !p.Enabled() {
		return Summary{}, fmt.Errorf("llm provider is not configured")
	}

	ctx, cancel := context.WithTimeout(ctx, p.timeout)
	defer cancel()

	reqBody := chatRequest{
		Model:       p.model,
		Messages:    BuildMessages(incident),
		Temperature: 0.2,
		MaxTokens:   p.maxTokens,
	}
	data, err := json.Marshal(reqBody)
	if err != nil {
		return Summary{}, fmt.Errorf("encode llm request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.baseURL+"/chat/completions", bytes.NewReader(data))
	if err != nil {
		return Summary{}, fmt.Errorf("create llm request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if p.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+p.apiKey)
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return Summary{}, fmt.Errorf("send llm request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return Summary{}, fmt.Errorf("read llm response: %w", err)
	}

	var decoded chatResponse
	if err := json.Unmarshal(body, &decoded); err != nil {
		return Summary{}, fmt.Errorf("decode llm response: %w", err)
	}
	if decoded.Error != nil && decoded.Error.Message != "" {
		return Summary{}, fmt.Errorf("llm error: %s", decoded.Error.Message)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return Summary{}, fmt.Errorf("llm returned status %d", resp.StatusCode)
	}
	if len(decoded.Choices) == 0 {
		return Summary{}, fmt.Errorf("llm returned no choices")
	}

	content := strings.TrimSpace(decoded.Choices[0].Message.Content)
	var summary Summary
	if err := json.Unmarshal([]byte(extractJSONObject(content)), &summary); err != nil {
		return Summary{}, fmt.Errorf("decode llm summary JSON: %w", err)
	}
	summary.RawProviderOutput = content
	return summary, nil
}

func extractJSONObject(content string) string {
	start := strings.Index(content, "{")
	end := strings.LastIndex(content, "}")
	if start >= 0 && end >= start {
		return content[start : end+1]
	}
	return content
}
