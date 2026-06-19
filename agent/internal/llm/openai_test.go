package llm

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestOpenAICompatibleSummarize(t *testing.T) {
	var sawAuth bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Fatalf("path = %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") == "Bearer secret" {
			sawAuth = true
		}

		var req chatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if req.Model != "test-model" {
			t.Fatalf("model = %q", req.Model)
		}
		payload, _ := json.Marshal(req)
		if strings.Contains(string(payload), "api_key=leak") {
			t.Fatalf("request leaked secret: %s", string(payload))
		}

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"choices": []map[string]interface{}{
				{"message": map[string]string{
					"role":    "assistant",
					"content": `{"title":"API down","likelyCauses":["service unavailable"],"evidence":["health check failed"],"suggestedActions":["check container logs"],"risk":"high","confidence":"medium"}`,
				}},
			},
		})
	}))
	defer server.Close()

	provider := NewOpenAICompatible(server.URL, "secret", "test-model", time.Second, 500, server.Client())
	summary, err := provider.Summarize(t.Context(), IncidentContext{
		ServiceName: "api",
		Message:     "api_key=leak",
	})
	if err != nil {
		t.Fatalf("Summarize returned error: %v", err)
	}
	if !sawAuth {
		t.Fatal("expected Authorization header")
	}
	if summary.Title != "API down" {
		t.Fatalf("Title = %q", summary.Title)
	}
	if len(summary.SuggestedActions) != 1 {
		t.Fatalf("SuggestedActions length = %d", len(summary.SuggestedActions))
	}
}

func TestOpenAICompatibleHandlesProviderError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error": map[string]string{"message": "bad request"},
		})
	}))
	defer server.Close()

	provider := NewOpenAICompatible(server.URL, "", "test-model", time.Second, 500, server.Client())
	_, err := provider.Summarize(t.Context(), IncidentContext{ServiceName: "api"})
	if err == nil {
		t.Fatal("expected provider error")
	}
}
