package handlers_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/alerter"
	"github.com/aiturn/everyup/internal/api"
	"github.com/aiturn/everyup/internal/api/websocket"
	"github.com/aiturn/everyup/internal/checker"
	"github.com/aiturn/everyup/internal/collector"
	"github.com/aiturn/everyup/internal/config"
	"github.com/aiturn/everyup/internal/crypto"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
)

// testServer holds all components needed for integration tests.
type testServer struct {
	App          *fiber.App
	scheduler    *checker.Scheduler
	collectorMgr *collector.CollectorManager
	alertMgr     *alerter.Manager
}

// setupTestServer creates a Fiber app with in-memory SQLite, real routes, and real middleware.
// Call cleanup() when done (usually via t.Cleanup).
func setupTestServer(t *testing.T) *testServer {
	t.Helper()

	// 1. In-memory SQLite ??fresh DB per test
	if err := database.Connect(":memory:"); err != nil {
		t.Fatalf("DB connect: %v", err)
	}

	// 2. Crypto init (auto-generates keys in DB)
	if err := crypto.InitFromDB(database.DB); err != nil {
		t.Fatalf("Crypto init: %v", err)
	}
	if err := crypto.InitJWTSecret(database.DB); err != nil {
		t.Fatalf("JWT init: %v", err)
	}

	// 3. Components
	app := fiber.New(fiber.Config{
		// Disable error logging in tests
		DisableStartupMessage: true,
		// Mirror production: decode percent-encoded path params so service keys
		// like "env:demo-prod" (sent as "env%3Ademo-prod") resolve correctly.
		UnescapePath: true,
	})

	hub := websocket.NewHub()
	go hub.Run()

	sched := checker.NewScheduler()
	sched.SetBroadcast(hub.GetBroadcastFunc())

	collMgr := collector.NewCollectorManager(5, 60)
	collMgr.SetBroadcast(hub.GetBroadcastFunc())

	alertMgr := alerter.NewManager()
	evaluator := alerter.NewRuleEvaluator(alertMgr, 5)
	collMgr.SetOnMetricCollected(evaluator.Evaluate)

	serviceEval := alerter.NewServiceRuleEvaluator(alertMgr)
	sched.SetServiceEvaluator(serviceEval)

	// 4. Routes — allow all origins for tests
	api.SetupRoutes(app, sched, collMgr, evaluator, serviceEval, "*", "test")

	// 5. Start scheduler with empty config
	if err := sched.Start([]config.ServiceConfig{}); err != nil {
		t.Fatalf("Scheduler start: %v", err)
	}

	ts := &testServer{
		App:          app,
		scheduler:    sched,
		collectorMgr: collMgr,
		alertMgr:     alertMgr,
	}

	t.Cleanup(func() {
		alertMgr.Shutdown()
		sched.Stop()
		collMgr.Stop()
		app.Shutdown()
		database.Close()
	})

	return ts
}

// apiResponse is the standard JSON envelope.
type apiResponse struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data,omitempty"`
	Error   *apiError       `json:"error,omitempty"`
}

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// doRequest sends an HTTP request to the test server and returns the parsed response.
func (ts *testServer) doRequest(t *testing.T, method, path string, body interface{}, headers ...string) (*http.Response, apiResponse) {
	t.Helper()

	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req := httptest.NewRequest(method, path, bodyReader)
	req.Header.Set("Content-Type", "application/json")

	// Apply extra headers (key-value pairs)
	for i := 0; i+1 < len(headers); i += 2 {
		req.Header.Set(headers[i], headers[i+1])
	}

	resp, err := ts.App.Test(req, -1)
	if err != nil {
		t.Fatalf("request %s %s: %v", method, path, err)
	}

	var result apiResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	resp.Body.Close()

	return resp, result
}

// setupAdmin creates the first admin user via /auth/setup and returns the JWT token.
func (ts *testServer) setupAdmin(t *testing.T, username, password string) string {
	t.Helper()

	_, result := ts.doRequest(t, "POST", "/api/v1/auth/setup", map[string]string{
		"username": username,
		"password": password,
	})
	if !result.Success {
		t.Fatalf("admin setup failed: %s", result.Error.Message)
	}

	// Extract token from Set-Cookie header
	resp, _ := ts.doRequest(t, "POST", "/api/v1/auth/login", map[string]string{
		"username": username,
		"password": password,
	})
	for _, cookie := range resp.Cookies() {
		if cookie.Name == "jwt_token" {
			return cookie.Value
		}
	}

	t.Fatal("jwt_token cookie not found after login")
	return ""
}

// authHeader returns Authorization header key-value pair for use with doRequest.
func authHeader(token string) []string {
	return []string{"Authorization", "Bearer " + token}
}

// ??? Auth Flow Tests ???????????????????????????????????????????????

func TestSetupStatus_NoUsers(t *testing.T) {
	ts := setupTestServer(t)

	resp, result := ts.doRequest(t, "GET", "/api/v1/auth/setup/status", nil)

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
	if !result.Success {
		t.Error("expected success=true")
	}

	var data struct {
		NeedsSetup bool `json:"needs_setup"`
	}
	json.Unmarshal(result.Data, &data)
	if !data.NeedsSetup {
		t.Error("expected needs_setup=true when no users exist")
	}
}

func TestSetup_CreatesAdmin(t *testing.T) {
	ts := setupTestServer(t)

	_, result := ts.doRequest(t, "POST", "/api/v1/auth/setup", map[string]string{
		"username": "admin",
		"password": "testpass123",
	})

	if !result.Success {
		t.Fatalf("setup failed: %v", result.Error)
	}

	var data struct {
		Username string `json:"username"`
		Role     string `json:"role"`
	}
	json.Unmarshal(result.Data, &data)
	if data.Username != "admin" {
		t.Errorf("username = %q, want %q", data.Username, "admin")
	}
	if data.Role != "admin" {
		t.Errorf("role = %q, want %q", data.Role, "admin")
	}
}

func TestSetup_RejectsSecondSetup(t *testing.T) {
	ts := setupTestServer(t)
	ts.setupAdmin(t, "admin", "testpass123")

	resp, result := ts.doRequest(t, "POST", "/api/v1/auth/setup", map[string]string{
		"username": "hacker",
		"password": "testpass123",
	})

	if resp.StatusCode != 403 {
		t.Errorf("status = %d, want 403", resp.StatusCode)
	}
	if result.Success {
		t.Error("expected success=false for second setup")
	}
}

func TestSetup_RejectsShortPassword(t *testing.T) {
	ts := setupTestServer(t)

	resp, result := ts.doRequest(t, "POST", "/api/v1/auth/setup", map[string]string{
		"username": "admin",
		"password": "short",
	})

	if resp.StatusCode != 400 {
		t.Errorf("status = %d, want 400", resp.StatusCode)
	}
	if result.Success {
		t.Error("expected success=false for short password")
	}
}

func TestLogin_ValidCredentials(t *testing.T) {
	ts := setupTestServer(t)
	ts.setupAdmin(t, "admin", "testpass123")

	resp, result := ts.doRequest(t, "POST", "/api/v1/auth/login", map[string]string{
		"username": "admin",
		"password": "testpass123",
	})

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
	if !result.Success {
		t.Error("expected login success")
	}

	// Verify cookie is set
	found := false
	for _, c := range resp.Cookies() {
		if c.Name == "jwt_token" && c.Value != "" {
			found = true
			if !c.HttpOnly {
				t.Error("jwt_token cookie should be HttpOnly")
			}
		}
	}
	if !found {
		t.Error("jwt_token cookie not found")
	}
}

func TestLogin_InvalidCredentials(t *testing.T) {
	ts := setupTestServer(t)
	ts.setupAdmin(t, "admin", "testpass123")

	resp, _ := ts.doRequest(t, "POST", "/api/v1/auth/login", map[string]string{
		"username": "admin",
		"password": "wrongpass",
	})

	if resp.StatusCode != 401 {
		t.Errorf("status = %d, want 401", resp.StatusCode)
	}
}

func TestMe_WithValidToken(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")

	resp, result := ts.doRequest(t, "GET", "/api/v1/auth/me", nil, authHeader(token)...)

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}

	var data struct {
		Username string `json:"username"`
	}
	json.Unmarshal(result.Data, &data)
	if data.Username != "admin" {
		t.Errorf("username = %q, want %q", data.Username, "admin")
	}
}

func TestMe_WithoutToken(t *testing.T) {
	ts := setupTestServer(t)

	resp, _ := ts.doRequest(t, "GET", "/api/v1/auth/me", nil)

	if resp.StatusCode != 401 {
		t.Errorf("status = %d, want 401", resp.StatusCode)
	}
}

// ??? Service CRUD Tests ????????????????????????????????????????????

func TestServiceCreate_RequiresAuth(t *testing.T) {
	ts := setupTestServer(t)

	resp, _ := ts.doRequest(t, "POST", "/api/v1/services", map[string]interface{}{
		"id": "svc-noauth", "name": "NoAuth", "type": "log",
	})

	if resp.StatusCode != 401 {
		t.Errorf("status = %d, want 401", resp.StatusCode)
	}
}

// ??? Host Tests ????????????????????????????????????????????????????

// ??? Health Check Tests ????????????????????????????????????????????

func TestHealth(t *testing.T) {
	ts := setupTestServer(t)

	req := httptest.NewRequest("GET", "/api/v1/health", nil)
	resp, err := ts.App.Test(req, -1)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("parse body: %v", err)
	}
	if result["success"] != true {
		t.Errorf("success = %v, want true", result["success"])
	}
	data, ok := result["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("data field missing or not an object")
	}
	if data["status"] != "healthy" {
		t.Errorf("status = %v, want healthy", data["status"])
	}
}

// ??? Notification Channel Tests ????????????????????????????????????

func TestNotificationChannel_CRUD(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	// Create
	_, createResult := ts.doRequest(t, "POST", "/api/v1/notifications", map[string]interface{}{
		"name": "Test Discord",
		"type": "discord",
		"config": map[string]string{
			"webhookUrl": "https://discord.com/api/webhooks/123/abc",
		},
	}, auth...)

	if !createResult.Success {
		t.Fatalf("create channel failed: %v", createResult.Error)
	}

	var channel struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Type string `json:"type"`
	}
	json.Unmarshal(createResult.Data, &channel)
	if channel.Name != "Test Discord" {
		t.Errorf("name = %q, want %q", channel.Name, "Test Discord")
	}

	// List
	_, listResult := ts.doRequest(t, "GET", "/api/v1/notifications", nil, auth...)
	if !listResult.Success {
		t.Fatalf("list channels failed: %v", listResult.Error)
	}

	// Toggle
	_, toggleResult := ts.doRequest(t, "POST", "/api/v1/notifications/"+channel.ID+"/toggle", nil, auth...)
	if !toggleResult.Success {
		t.Fatalf("toggle failed: %v", toggleResult.Error)
	}

	// Delete
	_, deleteResult := ts.doRequest(t, "DELETE", "/api/v1/notifications/"+channel.ID, nil, auth...)
	if !deleteResult.Success {
		t.Fatalf("delete failed: %v", deleteResult.Error)
	}
}

func TestNotificationChannel_GetHealth(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	// Create a channel so it can show up in health (only channels with history/rule links appear)
	_, _ = ts.doRequest(t, "POST", "/api/v1/notifications", map[string]interface{}{
		"name": "HC Discord",
		"type": "discord",
		"config": map[string]string{
			"webhookUrl": "https://discord.com/api/webhooks/123/abc",
		},
	}, auth...)

	resp, result := ts.doRequest(t, "GET", "/api/v1/notifications/health?days=7", nil, auth...)
	if resp.StatusCode != 200 {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	if !result.Success {
		t.Fatalf("expected success, got error: %v", result.Error)
	}

	var entries []map[string]interface{}
	if err := json.Unmarshal(result.Data, &entries); err != nil {
		t.Fatalf("decode health: %v", err)
	}
	// With no notification_history rows and no rule links, the array should be empty
	if len(entries) != 0 {
		t.Errorf("expected empty health list, got %d entries", len(entries))
	}
}

func TestNotificationChannel_InvalidType(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	resp, _ := ts.doRequest(t, "POST", "/api/v1/notifications", map[string]interface{}{
		"name":   "Bad Type",
		"type":   "email",
		"config": map[string]string{},
	}, auth...)

	if resp.StatusCode != 400 {
		t.Errorf("status = %d, want 400 for invalid type", resp.StatusCode)
	}
}

func TestNotificationChannel_TestConfigValidatesWithoutSaving(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	resp, result := ts.doRequest(t, "POST", "/api/v1/notifications/test", map[string]interface{}{
		"name": "Telegram Draft",
		"type": "telegram",
		"config": map[string]string{
			"botToken": "",
			"chatId":   "",
		},
	}, auth...)

	if resp.StatusCode != 400 {
		t.Errorf("status = %d, want 400 for invalid draft config", resp.StatusCode)
	}
	if result.Success {
		t.Fatal("expected success=false for invalid draft config")
	}
	if result.Error == nil || result.Error.Code != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %v", result.Error)
	}

	_, listResult := ts.doRequest(t, "GET", "/api/v1/notifications", nil, auth...)
	if !listResult.Success {
		t.Fatalf("list channels failed: %v", listResult.Error)
	}

	var channels []map[string]interface{}
	if err := json.Unmarshal(listResult.Data, &channels); err != nil {
		t.Fatalf("decode channels: %v", err)
	}
	if len(channels) != 0 {
		t.Fatalf("expected no saved channels after draft test validation failure, got %d", len(channels))
	}
}

func TestLogList_NotInterceptedByLogIngestApiKeyAuth(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	resp, result := ts.doRequest(t, "GET", "/api/v1/logs", nil, auth...)

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
	if !result.Success {
		t.Fatalf("get logs failed: %v", result.Error)
	}
}

// TestLogService_DefaultLogLevelFilter verifies that a new log service defaults
// its logLevelFilter to [error, warn, info] (DEBUG/TRACE are opt-in). Service
// creation moved out of the HTTP API in the agent-only architecture, so the
// service is seeded directly via the repository (which applies ToService's
// defaults) and read back through GET /services/:id.
func TestLogService_DefaultLogLevelFilter(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	seedLogService(t, "log-default-filter", "Default Filter")

	_, getResult := ts.doRequest(t, "GET", "/api/v1/services/log-default-filter", nil, auth...)
	if !getResult.Success {
		t.Fatalf("get service failed: %v", getResult.Error)
	}
	var svc struct {
		LogLevelFilter []string `json:"logLevelFilter"`
	}
	if err := json.Unmarshal(getResult.Data, &svc); err != nil {
		t.Fatalf("unmarshal service: %v", err)
	}

	if len(svc.LogLevelFilter) != 3 {
		t.Fatalf("logLevelFilter len = %d, want 3 — got %v", len(svc.LogLevelFilter), svc.LogLevelFilter)
	}
	want := map[string]bool{"error": true, "warn": true, "info": true}
	for _, l := range svc.LogLevelFilter {
		if !want[l] {
			t.Errorf("unexpected level %q in default filter", l)
		}
	}
}

// seedLogService inserts a log-type service directly via the repository and
// returns the plaintext API key for authenticating OTLP/log ingest. The
// POST /services write path was removed in the agent-only architecture, so
// tests seed fixtures through the repository instead. ToService applies the
// same defaults (e.g. logLevelFilter) the old create handler relied on.
func seedLogService(t *testing.T, id, name string) (*models.Service, string) {
	t.Helper()
	apiKey := "evup_" + id
	svc := (&models.ServiceCreateRequest{ID: id, Name: name, Type: models.ServiceTypeLog}).ToService()
	svc.ApiKey = apiKey
	svc.ApiKeyMasked = "evup_****"
	if err := database.NewServiceRepository().Create(svc); err != nil {
		t.Fatalf("seed log service %q: %v", id, err)
	}
	return svc, apiKey
}

// ??? Alert Rule Tests ??????????????????????????????????????????????

func TestAlertRule_CRUD(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	// Create
	_, createResult := ts.doRequest(t, "POST", "/api/v1/alert-rules", map[string]interface{}{
		"name":      "High CPU",
		"type":      "resource",
		"metric":    "cpu",
		"operator":  ">",
		"threshold": 90,
		"duration":  5,
		"severity":  "critical",
		"cooldown":  300,
		"hostId":    "local",
	}, auth...)

	if !createResult.Success {
		t.Fatalf("create rule failed: %v", createResult.Error)
	}

	var rule struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	json.Unmarshal(createResult.Data, &rule)

	// Toggle
	_, toggleResult := ts.doRequest(t, "POST", "/api/v1/alert-rules/"+rule.ID+"/toggle", nil, auth...)
	if !toggleResult.Success {
		t.Fatalf("toggle failed: %v", toggleResult.Error)
	}

	// Delete
	_, deleteResult := ts.doRequest(t, "DELETE", "/api/v1/alert-rules/"+rule.ID, nil, auth...)
	if !deleteResult.Success {
		t.Fatalf("delete failed: %v", deleteResult.Error)
	}
}

// ─── Agent (Project) API Key Tests ──────────────────────────────────

// TestAgentApiKey_RevealAndRotate verifies a project's API key can be revealed
// after creation and rotated to a new key (unlimited re-issue).
func TestAgentApiKey_RevealAndRotate(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	// Create a project — the API key is returned once here.
	_, createResult := ts.doRequest(t, "POST", "/api/v1/agents", map[string]string{"name": "payments"}, auth...)
	if !createResult.Success {
		t.Fatalf("create failed: %v", createResult.Error)
	}
	var created struct {
		ID     string `json:"id"`
		APIKey string `json:"apiKey"`
	}
	json.Unmarshal(createResult.Data, &created)
	if created.ID == "" || created.APIKey == "" {
		t.Fatalf("expected id and apiKey, got %+v", created)
	}

	// Reveal — must return the SAME key, marked available.
	_, keyResult := ts.doRequest(t, "GET", "/api/v1/agents/"+created.ID+"/key", nil, auth...)
	if !keyResult.Success {
		t.Fatalf("get key failed: %v", keyResult.Error)
	}
	var revealed struct {
		APIKey    string `json:"apiKey"`
		Available bool   `json:"available"`
	}
	json.Unmarshal(keyResult.Data, &revealed)
	if !revealed.Available {
		t.Error("expected available=true for a freshly created project")
	}
	if revealed.APIKey != created.APIKey {
		t.Errorf("revealed key = %q, want %q (must match created key)", revealed.APIKey, created.APIKey)
	}

	// Rotate — returns a new, different key.
	_, rotateResult := ts.doRequest(t, "POST", "/api/v1/agents/"+created.ID+"/rotate-key", nil, auth...)
	if !rotateResult.Success {
		t.Fatalf("rotate failed: %v", rotateResult.Error)
	}
	var rotated struct {
		APIKey string `json:"apiKey"`
	}
	json.Unmarshal(rotateResult.Data, &rotated)
	if rotated.APIKey == "" || rotated.APIKey == created.APIKey {
		t.Errorf("rotated key = %q, want a new key different from %q", rotated.APIKey, created.APIKey)
	}

	// Reveal again — now returns the rotated key (rotation persisted).
	_, keyResult2 := ts.doRequest(t, "GET", "/api/v1/agents/"+created.ID+"/key", nil, auth...)
	var revealed2 struct {
		APIKey string `json:"apiKey"`
	}
	json.Unmarshal(keyResult2.Data, &revealed2)
	if revealed2.APIKey != rotated.APIKey {
		t.Errorf("after rotation revealed = %q, want %q", revealed2.APIKey, rotated.APIKey)
	}

	// Unknown project → 404.
	resp, _ := ts.doRequest(t, "GET", "/api/v1/agents/agent_does_not_exist/key", nil, auth...)
	if resp.StatusCode != 404 {
		t.Errorf("status = %d, want 404 for unknown project", resp.StatusCode)
	}
}

// ─── Agent (Project) Deletion Tests ─────────────────────────────────

// TestAgentDelete_RemovesProjectFromListings verifies a deleted (deactivated)
// project — and its reported services — disappear from the list endpoints.
// Regression test: deactivation set status='inactive' but the listing queries
// did not filter on status, so deleted projects/cards lingered in the UI.
func TestAgentDelete_RemovesProjectFromListings(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	// Create a project.
	_, createResult := ts.doRequest(t, "POST", "/api/v1/agents", map[string]string{"name": "to-delete"}, auth...)
	if !createResult.Success {
		t.Fatalf("create failed: %v", createResult.Error)
	}
	var created struct {
		ID string `json:"id"`
	}
	json.Unmarshal(createResult.Data, &created)

	// Seed a reported service so it shows up in the services listing.
	repo := database.NewAgentRepository()
	if err := repo.UpsertServices(created.ID, time.Now(), []models.AgentService{{
		AgentID: created.ID, Key: "api", Name: "api", CheckType: "http",
		Endpoint: "http://api/health", Healthy: true, Seen: true, ObservedAt: time.Now(),
	}}); err != nil {
		t.Fatalf("seed services: %v", err)
	}

	// Sanity: project + service are listed before deletion.
	if !listHasAgent(t, ts, auth, created.ID) {
		t.Fatal("project should be listed before deletion")
	}
	if !servicesHaveAgent(t, ts, auth, created.ID) {
		t.Fatal("service should be listed before deletion")
	}

	// Delete (soft-delete / deactivate) — returns 204 No Content (empty body),
	// so bypass doRequest's JSON decode and check the status directly.
	req := httptest.NewRequest("DELETE", "/api/v1/agents/"+created.ID, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	delResp, err := ts.App.Test(req, -1)
	if err != nil {
		t.Fatalf("delete request: %v", err)
	}
	delResp.Body.Close()
	if delResp.StatusCode != 204 {
		t.Fatalf("delete status = %d, want 204", delResp.StatusCode)
	}

	// The deleted project must disappear from both listings.
	if listHasAgent(t, ts, auth, created.ID) {
		t.Error("deleted project still appears in GET /agents")
	}
	if servicesHaveAgent(t, ts, auth, created.ID) {
		t.Error("deleted project's service still appears in GET /agents/services/all")
	}
}

func listHasAgent(t *testing.T, ts *testServer, auth []string, id string) bool {
	t.Helper()
	_, result := ts.doRequest(t, "GET", "/api/v1/agents", nil, auth...)
	var agents []struct {
		ID string `json:"id"`
	}
	json.Unmarshal(result.Data, &agents)
	for _, a := range agents {
		if a.ID == id {
			return true
		}
	}
	return false
}

func servicesHaveAgent(t *testing.T, ts *testServer, auth []string, id string) bool {
	t.Helper()
	_, result := ts.doRequest(t, "GET", "/api/v1/agents/services/all", nil, auth...)
	var svcs []struct {
		AgentID string `json:"agentId"`
	}
	json.Unmarshal(result.Data, &svcs)
	for _, s := range svcs {
		if s.AgentID == id {
			return true
		}
	}
	return false
}

// TestAgentServiceLogs_KeyResolution is a regression test for two bugs that
// broke the per-service logs/requests endpoints:
//  1. GetServiceLogs filtered on a non-existent column l.service_name → DATABASE_ERROR.
//  2. Fiber's default UnescapePath=false left percent-encoded keys (env:demo-prod
//     arrives as env%3Ademo-prod) undecoded, so the lookup returned NOT_FOUND.
//
// Both the colon-containing env key and a hash-style key must resolve to 200,
// while an unknown key still returns 404.
func TestAgentServiceLogs_KeyResolution(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	_, createResult := ts.doRequest(t, "POST", "/api/v1/agents", map[string]string{"name": "logs-proj"}, auth...)
	if !createResult.Success {
		t.Fatalf("create failed: %v", createResult.Error)
	}
	var created struct {
		ID string `json:"id"`
	}
	json.Unmarshal(createResult.Data, &created)

	// Seed two services: one env-style key (with a colon) and one hash-style key.
	const hashKey = "06190025aa11d5f9716dbe0cd42a0e1ebb474e896eb39681bbb787dda832ebd1"
	repo := database.NewAgentRepository()
	if err := repo.UpsertServices(created.ID, time.Now(), []models.AgentService{
		{AgentID: created.ID, Key: "env:demo-prod", Name: "demo-prod", CheckType: "http", Healthy: true, Seen: true, ObservedAt: time.Now()},
		{AgentID: created.ID, Key: hashKey, Name: "discovered-api", CheckType: "http", Healthy: true, Seen: true, ObservedAt: time.Now()},
	}); err != nil {
		t.Fatalf("seed services: %v", err)
	}

	// The env key is sent percent-encoded by the frontend (encodeURIComponent).
	base := "/api/v1/agents/" + created.ID + "/services/"
	cases := []struct {
		name       string
		path       string
		wantStatus int
	}{
		{"env key (percent-encoded colon)", base + "env%3Ademo-prod/logs", 200},
		{"hash key", base + hashKey + "/logs", 200},
		{"env key requests", base + "env%3Ademo-prod/requests", 200},
		{"unknown key", base + "env%3Anope/logs", 404},
		// log-filter must agree with logs/requests on existence (was always 200).
		{"log-filter known key", base + hashKey + "/log-filter", 200},
		{"log-filter unknown key", base + "env%3Anope/log-filter", 404},
	}
	for _, tc := range cases {
		resp, result := ts.doRequest(t, "GET", tc.path, nil, auth...)
		if resp.StatusCode != tc.wantStatus {
			t.Errorf("%s: status = %d (%v), want %d", tc.name, resp.StatusCode, result.Error, tc.wantStatus)
		}
		if tc.wantStatus == 200 && !result.Success {
			t.Errorf("%s: success = false, error = %v", tc.name, result.Error)
		}
	}
}
