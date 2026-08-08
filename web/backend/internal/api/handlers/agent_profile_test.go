package handlers_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestAgentCustomProfileControlsJoinBundle(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")

	_, createResult := ts.doRequest(t, "POST", "/api/v1/agents", map[string]interface{}{
		"name": "metrics-agent",
		"profile": map[string]interface{}{
			"kind":         "custom",
			"capabilities": []string{"metrics"},
		},
	}, authHeader(token)...)
	if !createResult.Success {
		t.Fatalf("create failed: %v", createResult.Error)
	}
	var created struct {
		ID       string `json:"id"`
		JoinCode string `json:"joinCode"`
		Profile  struct {
			Kind         string   `json:"kind"`
			Capabilities []string `json:"capabilities"`
		} `json:"profile"`
	}
	if err := json.Unmarshal(createResult.Data, &created); err != nil {
		t.Fatal(err)
	}
	if created.ID == "" || created.JoinCode == "" || created.Profile.Kind != "custom" || len(created.Profile.Capabilities) != 1 || created.Profile.Capabilities[0] != "metrics" {
		t.Fatalf("unexpected created Agent: %+v", created)
	}

	form := url.Values{"baseUrl": {"https://everyup.example.com"}}
	joinReq := httptest.NewRequest("POST", "/api/v1/agents/join", strings.NewReader(form.Encode()))
	joinReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	joinReq.Header.Set("Authorization", "Bearer "+created.JoinCode)
	joinResp, err := ts.App.Test(joinReq)
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(joinResp.Body)
	if joinResp.StatusCode != http.StatusOK {
		t.Fatalf("join status=%d body=%s", joinResp.StatusCode, body)
	}
	compose := string(body)
	for _, unwanted := range []string{"/var/run/docker.sock", "/:/hostfs:ro", "everyup-ebpf:", "privileged: true", "group_add:"} {
		if strings.Contains(compose, unwanted) {
			t.Fatalf("metrics-only Compose must omit %q", unwanted)
		}
	}
	if !strings.Contains(compose, "EVERYUP_TELEMETRY_GATEWAY_ENABLED: \"true\"") {
		t.Fatalf("metrics-only Compose must enable the OTLP gateway: %s", compose)
	}
}
