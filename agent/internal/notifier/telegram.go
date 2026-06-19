package notifier

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type Telegram struct {
	apiBase string
	token   string
	chatIDs []string
	client  *http.Client
}

func NewTelegram(apiBase, token string, chatIDs []string, client *http.Client) *Telegram {
	if client == nil {
		client = http.DefaultClient
	}
	return &Telegram{
		apiBase: strings.TrimRight(apiBase, "/"),
		token:   token,
		chatIDs: append([]string(nil), chatIDs...),
		client:  client,
	}
}

func (t *Telegram) Send(ctx context.Context, msg Message) error {
	text := renderPlain(msg)
	var errs []string
	for _, chatID := range t.chatIDs {
		if err := t.sendMessage(ctx, chatID, text); err != nil {
			errs = append(errs, err.Error())
		}
	}
	if len(errs) > 0 {
		return fmt.Errorf("telegram send failed: %s", strings.Join(errs, "; "))
	}
	return nil
}

func (t *Telegram) sendMessage(ctx context.Context, chatID, text string) error {
	payload := map[string]string{
		"chat_id": chatID,
		"text":    text,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	endpoint := fmt.Sprintf("%s/bot%s/sendMessage", t.apiBase, t.token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := t.client.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		responseBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("telegram api returned %d: %s", resp.StatusCode, strings.TrimSpace(string(responseBody)))
	}
	return nil
}

func renderPlain(msg Message) string {
	when := msg.Time.Format("2006-01-02 15:04:05")
	parts := []string{
		fmt.Sprintf("[EveryUp Agent] %s", msg.Title),
		fmt.Sprintf("Severity: %s", msg.Severity),
		fmt.Sprintf("Type: %s", msg.AlertType),
		fmt.Sprintf("Service: %s", msg.ServiceName),
		fmt.Sprintf("Time: %s", when),
	}
	if strings.TrimSpace(msg.Body) != "" {
		parts = append(parts, "", msg.Body)
	}
	return strings.Join(parts, "\n")
}
