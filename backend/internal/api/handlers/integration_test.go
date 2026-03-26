package handlers_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/aiturn/everyup/internal/alerter"
	"github.com/aiturn/everyup/internal/api"
	"github.com/aiturn/everyup/internal/api/websocket"
	"github.com/aiturn/everyup/internal/checker"
	"github.com/aiturn/everyup/internal/collector"
	"github.com/aiturn/everyup/internal/config"
	"github.com/aiturn/everyup/internal/crypto"
	"github.com/aiturn/everyup/internal/database"
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

	// 1. In-memory SQLite — fresh DB per test
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
	api.SetupRoutes(app, sched, collMgr, "*", "test")

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

// ─── Auth Flow Tests ───────────────────────────────────────────────

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

// ─── Service CRUD Tests ────────────────────────────────────────────

func TestServiceCRUD(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	// Create
	_, createResult := ts.doRequest(t, "POST", "/api/v1/services", map[string]interface{}{
		"id":   "svc-test-1",
		"name": "Test Service",
		"type": "log",
	}, auth...)

	if !createResult.Success {
		t.Fatalf("create failed: %v", createResult.Error)
	}

	var created struct {
		ID     string `json:"id"`
		Name   string `json:"name"`
		ApiKey string `json:"apiKey"`
	}
	json.Unmarshal(createResult.Data, &created)
	if created.ID != "svc-test-1" {
		t.Errorf("id = %q, want %q", created.ID, "svc-test-1")
	}
	if created.ApiKey == "" {
		t.Error("expected apiKey in creation response")
	}

	// Read
	_, getResult := ts.doRequest(t, "GET", "/api/v1/services/svc-test-1", nil, auth...)
	if !getResult.Success {
		t.Fatalf("get failed: %v", getResult.Error)
	}

	// Update
	_, updateResult := ts.doRequest(t, "PUT", "/api/v1/services/svc-test-1", map[string]interface{}{
		"name": "Updated Service",
	}, auth...)
	if !updateResult.Success {
		t.Fatalf("update failed: %v", updateResult.Error)
	}

	var updated struct {
		Name string `json:"name"`
	}
	json.Unmarshal(updateResult.Data, &updated)
	if updated.Name != "Updated Service" {
		t.Errorf("name = %q, want %q", updated.Name, "Updated Service")
	}

	// List
	_, listResult := ts.doRequest(t, "GET", "/api/v1/services", nil, auth...)
	if !listResult.Success {
		t.Fatalf("list failed: %v", listResult.Error)
	}

	// Delete
	_, deleteResult := ts.doRequest(t, "DELETE", "/api/v1/services/svc-test-1", nil, auth...)
	if !deleteResult.Success {
		t.Fatalf("delete failed: %v", deleteResult.Error)
	}

	// Verify deleted
	resp, _ := ts.doRequest(t, "GET", "/api/v1/services/svc-test-1", nil, auth...)
	if resp.StatusCode != 404 {
		t.Errorf("status = %d, want 404 after delete", resp.StatusCode)
	}
}

func TestServiceCreate_DuplicateID(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	svc := map[string]interface{}{"id": "dup-1", "name": "Dup", "type": "log"}
	ts.doRequest(t, "POST", "/api/v1/services", svc, auth...)

	resp, _ := ts.doRequest(t, "POST", "/api/v1/services", svc, auth...)
	if resp.StatusCode != 409 {
		t.Errorf("status = %d, want 409 for duplicate", resp.StatusCode)
	}
}

func TestServiceCreate_RequiresAuth(t *testing.T) {
	ts := setupTestServer(t)

	resp, _ := ts.doRequest(t, "POST", "/api/v1/services", map[string]interface{}{
		"id": "svc-noauth", "name": "NoAuth", "type": "log",
	})

	if resp.StatusCode != 401 {
		t.Errorf("status = %d, want 401", resp.StatusCode)
	}
}

func TestServiceCreate_InputValidation(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	// Missing required fields
	resp, _ := ts.doRequest(t, "POST", "/api/v1/services", map[string]interface{}{
		"name": "NoID",
	}, auth...)
	if resp.StatusCode != 400 {
		t.Errorf("status = %d, want 400 for missing id", resp.StatusCode)
	}
}

// ─── Host Tests ────────────────────────────────────────────────────

func TestHostCreate_ReservedID(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	resp, result := ts.doRequest(t, "POST", "/api/v1/hosts", map[string]interface{}{
		"id":   "local",
		"name": "Hacked Local",
		"type": "remote",
	}, auth...)

	if resp.StatusCode != 400 {
		t.Errorf("status = %d, want 400 for reserved ID", resp.StatusCode)
	}
	if result.Error == nil || result.Error.Code != "VALIDATION_ERROR" {
		t.Errorf("expected VALIDATION_ERROR, got %v", result.Error)
	}
}

// ─── Health Check Tests ────────────────────────────────────────────

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

// ─── Notification Channel Tests ────────────────────────────────────

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

// ─── Log Ingest Tests ──────────────────────────────────────────────

func TestLogIngest_WithApiKey(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	// First create a log service to get an API key
	_, createResult := ts.doRequest(t, "POST", "/api/v1/services", map[string]interface{}{
		"id":   "log-svc-1",
		"name": "Log Service",
		"type": "log",
	}, auth...)

	var svc struct {
		ApiKey string `json:"apiKey"`
	}
	json.Unmarshal(createResult.Data, &svc)

	// Ingest a log entry using the API key
	resp, result := ts.doRequest(t, "POST", "/api/v1/logs/ingest", map[string]interface{}{
		"level":   "error",
		"message": "Test error log from integration test",
	}, "Authorization", "Bearer "+svc.ApiKey)

	if resp.StatusCode != 201 {
		t.Errorf("status = %d, want 201", resp.StatusCode)
	}
	if !result.Success {
		t.Fatalf("ingest failed: %v", result.Error)
	}

	// Verify log appears in list
	_, logsResult := ts.doRequest(t, "GET", "/api/v1/services/log-svc-1/logs", nil, auth...)
	if !logsResult.Success {
		t.Fatalf("get logs failed: %v", logsResult.Error)
	}
}

func TestLogIngest_InvalidApiKey(t *testing.T) {
	ts := setupTestServer(t)

	resp, _ := ts.doRequest(t, "POST", "/api/v1/logs/ingest", map[string]interface{}{
		"level":   "error",
		"message": "Should fail",
	}, "Authorization", "Bearer invalid-key-12345")

	if resp.StatusCode != 401 {
		t.Errorf("status = %d, want 401", resp.StatusCode)
	}
}

func TestLogIngest_BatchLimit(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	// Create service
	_, createResult := ts.doRequest(t, "POST", "/api/v1/services", map[string]interface{}{
		"id": "log-batch", "name": "Batch Test", "type": "log",
	}, auth...)

	var svc struct {
		ApiKey string `json:"apiKey"`
	}
	json.Unmarshal(createResult.Data, &svc)

	// Send batch exceeding limit (101 entries, max is 100)
	logs := make([]map[string]string, 101)
	for i := range logs {
		logs[i] = map[string]string{"level": "error", "message": "log entry"}
	}

	resp, _ := ts.doRequest(t, "POST", "/api/v1/logs/ingest", map[string]interface{}{
		"logs": logs,
	}, "Authorization", "Bearer "+svc.ApiKey)

	if resp.StatusCode != 400 {
		t.Errorf("status = %d, want 400 for exceeding batch limit", resp.StatusCode)
	}
}

// ─── Alert Rule Tests ──────────────────────────────────────────────

func TestAlertRule_CRUD(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	// Create
	_, createResult := ts.doRequest(t, "POST", "/api/v1/alert-rules", map[string]interface{}{
		"name":     "High CPU",
		"type":     "resource",
		"metric":   "cpu",
		"operator": ">",
		"threshold": 90,
		"duration":  5,
		"severity": "critical",
		"cooldown": 300,
		"hostId":   "local",
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
