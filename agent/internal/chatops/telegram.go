package chatops

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type TelegramBot struct {
	apiBase     string
	token       string
	allowed     map[string]bool
	handler     *Handler
	client      *http.Client
	pollTimeout time.Duration
}

type updateResponse struct {
	OK     bool `json:"ok"`
	Result []struct {
		UpdateID int `json:"update_id"`
		Message  *struct {
			Text string `json:"text"`
			Chat struct {
				ID int64 `json:"id"`
			} `json:"chat"`
		} `json:"message"`
	} `json:"result"`
	Description string `json:"description,omitempty"`
}

func NewTelegramBot(apiBase, token string, allowedChatIDs []string, handler *Handler, client *http.Client) *TelegramBot {
	if client == nil {
		client = &http.Client{Timeout: 35 * time.Second}
	}
	allowed := make(map[string]bool, len(allowedChatIDs))
	for _, chatID := range allowedChatIDs {
		chatID = strings.TrimSpace(chatID)
		if chatID != "" {
			allowed[chatID] = true
		}
	}
	return &TelegramBot{
		apiBase:     strings.TrimRight(apiBase, "/"),
		token:       token,
		allowed:     allowed,
		handler:     handler,
		client:      client,
		pollTimeout: 25 * time.Second,
	}
}

func (b *TelegramBot) Run(ctx context.Context) error {
	offset := 0
	for {
		select {
		case <-ctx.Done():
			return nil
		default:
		}

		updates, err := b.getUpdates(ctx, offset)
		if err != nil {
			log.Printf("telegram chatops polling failed: %v", err)
			sleep(ctx, 2*time.Second)
			continue
		}
		for _, update := range updates.Result {
			if update.UpdateID >= offset {
				offset = update.UpdateID + 1
			}
			if update.Message == nil || strings.TrimSpace(update.Message.Text) == "" {
				continue
			}
			chatID := strconv.FormatInt(update.Message.Chat.ID, 10)
			if !b.allowed[chatID] {
				log.Printf("telegram chatops rejected chat_id=%s", chatID)
				continue
			}
			response := b.handler.Handle(ctx, chatID, update.Message.Text)
			if response == "" {
				continue
			}
			if err := b.sendMessage(ctx, chatID, response); err != nil {
				log.Printf("telegram chatops response failed: %v", err)
			}
		}
	}
}

func (b *TelegramBot) getUpdates(ctx context.Context, offset int) (updateResponse, error) {
	endpoint := fmt.Sprintf("%s/bot%s/getUpdates?timeout=%d&offset=%d", b.apiBase, b.token, int(b.pollTimeout.Seconds()), offset)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return updateResponse{}, fmt.Errorf("create getUpdates request: %w", err)
	}
	resp, err := b.client.Do(req)
	if err != nil {
		return updateResponse{}, fmt.Errorf("getUpdates request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return updateResponse{}, fmt.Errorf("read getUpdates response: %w", err)
	}
	var decoded updateResponse
	if err := json.Unmarshal(body, &decoded); err != nil {
		return updateResponse{}, fmt.Errorf("decode getUpdates response: %w", err)
	}
	if !decoded.OK {
		return updateResponse{}, fmt.Errorf("telegram getUpdates failed: %s", decoded.Description)
	}
	return decoded, nil
}

func (b *TelegramBot) sendMessage(ctx context.Context, chatID, text string) error {
	payload := map[string]string{
		"chat_id": chatID,
		"text":    text,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal sendMessage payload: %w", err)
	}
	endpoint := fmt.Sprintf("%s/bot%s/sendMessage", b.apiBase, b.token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("create sendMessage request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := b.client.Do(req)
	if err != nil {
		return fmt.Errorf("sendMessage request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("sendMessage returned %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

func sleep(ctx context.Context, duration time.Duration) {
	timer := time.NewTimer(duration)
	defer timer.Stop()
	select {
	case <-ctx.Done():
	case <-timer.C:
	}
}
