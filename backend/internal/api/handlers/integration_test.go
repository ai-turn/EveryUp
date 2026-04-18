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

func TestLogIngest_RejectsNonLogServiceApiKey(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	_, createResult := ts.doRequest(t, "POST", "/api/v1/services", map[string]interface{}{
		"id":   "http-svc-1",
		"name": "HTTP Service",
		"type": "http",
		"url":  "https://example.com",
	}, auth...)

	var svc struct {
		ApiKey string `json:"apiKey"`
	}
	json.Unmarshal(createResult.Data, &svc)

	resp, _ := ts.doRequest(t, "POST", "/api/v1/logs/ingest", map[string]interface{}{
		"level":   "error",
		"message": "Should be rejected",
	}, "Authorization", "Bearer "+svc.ApiKey)

	if resp.StatusCode != 403 {
		t.Errorf("status = %d, want 403 for non-log service API key", resp.StatusCode)
	}
}

func TestLogIngest_RejectsInactiveLogService(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	_, createResult := ts.doRequest(t, "POST", "/api/v1/services", map[string]interface{}{
		"id":   "log-inactive-1",
		"name": "Inactive Log Service",
		"type": "log",
	}, auth...)

	var svc struct {
		ApiKey string `json:"apiKey"`
	}
	json.Unmarshal(createResult.Data, &svc)

	_, pauseResult := ts.doRequest(t, "POST", "/api/v1/services/log-inactive-1/pause", nil, auth...)
	if !pauseResult.Success {
		t.Fatalf("pause failed: %v", pauseResult.Error)
	}

	resp, _ := ts.doRequest(t, "POST", "/api/v1/logs/ingest", map[string]interface{}{
		"level":   "error",
		"message": "Should be rejected while inactive",
	}, "Authorization", "Bearer "+svc.ApiKey)

	if resp.StatusCode != 403 {
		t.Errorf("status = %d, want 403 for inactive log service", resp.StatusCode)
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

// ─── API Request Ingest Tests ──────────────────────────────────────

// createLogServiceForIngest is a helper that creates a log service and returns its API key.
func createLogServiceForIngest(t *testing.T, ts *testServer, id string) string {
	t.Helper()
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	_, createResult := ts.doRequest(t, "POST", "/api/v1/services", map[string]interface{}{
		"id":   id,
		"name": "Ingest Test Service",
		"type": "log",
	}, auth...)

	if !createResult.Success {
		t.Fatalf("create service failed: %v", createResult.Error)
	}

	var svc struct {
		ApiKey string `json:"apiKey"`
	}
	json.Unmarshal(createResult.Data, &svc)
	if svc.ApiKey == "" {
		t.Fatal("apiKey missing from created service")
	}
	return svc.ApiKey
}

func TestApiRequestIngest_WithApiKey(t *testing.T) {
	ts := setupTestServer(t)
	apiKey := createLogServiceForIngest(t, ts, "req-svc-1")

	// Set capture mode to "all" so the request is stored
	_, err := database.DB.Exec(
		`UPDATE services SET api_capture_mode = 'all' WHERE id = ?`,
		"req-svc-1",
	)
	if err != nil {
		t.Fatalf("update capture mode: %v", err)
	}

	resp, result := ts.doRequest(t, "POST", "/api/v1/ingest/requests", map[string]interface{}{
		"method":     "GET",
		"path":       "/api/users/123",
		"statusCode": 200,
		"durationMs": 45,
	}, "Authorization", "Bearer "+apiKey)

	if resp.StatusCode != 201 {
		t.Errorf("status = %d, want 201", resp.StatusCode)
	}
	if !result.Success {
		t.Fatalf("ingest failed: %v", result.Error)
	}

	var data struct {
		Processed int `json:"processed"`
		Filtered  int `json:"filtered"`
		Errors    int `json:"errors"`
		Total     int `json:"total"`
	}
	json.Unmarshal(result.Data, &data)
	if data.Processed != 1 {
		t.Errorf("processed = %d, want 1", data.Processed)
	}
	if data.Total != 1 {
		t.Errorf("total = %d, want 1", data.Total)
	}
}

func TestApiRequestIngest_ModeDisabled(t *testing.T) {
	ts := setupTestServer(t)
	apiKey := createLogServiceForIngest(t, ts, "req-svc-disabled")

	// Set capture mode to "disabled"
	_, err := database.DB.Exec(
		`UPDATE services SET api_capture_mode = 'disabled' WHERE id = ?`,
		"req-svc-disabled",
	)
	if err != nil {
		t.Fatalf("update capture mode: %v", err)
	}

	resp, result := ts.doRequest(t, "POST", "/api/v1/ingest/requests", map[string]interface{}{
		"method":     "POST",
		"path":       "/api/login",
		"statusCode": 200,
		"durationMs": 10,
	}, "Authorization", "Bearer "+apiKey)

	if resp.StatusCode != 201 {
		t.Errorf("status = %d, want 201", resp.StatusCode)
	}
	if !result.Success {
		t.Fatalf("ingest failed: %v", result.Error)
	}

	var data struct {
		Processed int `json:"processed"`
		Filtered  int `json:"filtered"`
	}
	json.Unmarshal(result.Data, &data)
	if data.Filtered != 1 {
		t.Errorf("filtered = %d, want 1 (mode=disabled should filter all)", data.Filtered)
	}
	if data.Processed != 0 {
		t.Errorf("processed = %d, want 0", data.Processed)
	}
}

func TestApiRequestIngest_ModeErrorsOnly(t *testing.T) {
	ts := setupTestServer(t)
	apiKey := createLogServiceForIngest(t, ts, "req-svc-errors")

	// Set capture mode to "errors_only"
	_, err := database.DB.Exec(
		`UPDATE services SET api_capture_mode = 'errors_only' WHERE id = ?`,
		"req-svc-errors",
	)
	if err != nil {
		t.Fatalf("update capture mode: %v", err)
	}

	// Send two entries: a success and an error
	resp, result := ts.doRequest(t, "POST", "/api/v1/ingest/requests", map[string]interface{}{
		"requests": []map[string]interface{}{
			{"method": "GET", "path": "/ok", "statusCode": 200, "durationMs": 10},
			{"method": "GET", "path": "/fail", "statusCode": 500, "durationMs": 20},
		},
	}, "Authorization", "Bearer "+apiKey)

	if resp.StatusCode != 201 {
		t.Errorf("status = %d, want 201", resp.StatusCode)
	}
	if !result.Success {
		t.Fatalf("ingest failed: %v", result.Error)
	}

	var data struct {
		Processed int `json:"processed"`
		Filtered  int `json:"filtered"`
		Total     int `json:"total"`
	}
	json.Unmarshal(result.Data, &data)
	if data.Processed != 1 {
		t.Errorf("processed = %d, want 1 (only 500 should be stored)", data.Processed)
	}
	if data.Filtered != 1 {
		t.Errorf("filtered = %d, want 1 (200 should be filtered)", data.Filtered)
	}
	if data.Total != 2 {
		t.Errorf("total = %d, want 2", data.Total)
	}
}

func TestApiRequestIngest_MasksHeaders(t *testing.T) {
	ts := setupTestServer(t)
	apiKey := createLogServiceForIngest(t, ts, "req-svc-mask")

	// Set capture mode to "all" and ensure authorization is in masked headers (it's in default)
	_, err := database.DB.Exec(
		`UPDATE services SET api_capture_mode = 'all' WHERE id = ?`,
		"req-svc-mask",
	)
	if err != nil {
		t.Fatalf("update capture mode: %v", err)
	}

	resp, result := ts.doRequest(t, "POST", "/api/v1/ingest/requests", map[string]interface{}{
		"method":     "GET",
		"path":       "/api/profile",
		"statusCode": 200,
		"durationMs": 30,
		"reqHeaders": map[string]string{
			"Authorization": "Bearer xyz-secret-token",
			"Content-Type":  "application/json",
		},
	}, "Authorization", "Bearer "+apiKey)

	if resp.StatusCode != 201 {
		t.Errorf("status = %d, want 201", resp.StatusCode)
	}
	if !result.Success {
		t.Fatalf("ingest failed: %v", result.Error)
	}

	// Query DB directly to verify authorization header is masked
	var reqHeadersRaw string
	queryErr := database.DB.QueryRow(
		`SELECT req_headers FROM api_requests WHERE service_id = ? ORDER BY id DESC LIMIT 1`,
		"req-svc-mask",
	).Scan(&reqHeadersRaw)
	if queryErr != nil {
		t.Fatalf("query req_headers: %v", queryErr)
	}

	var headers map[string]string
	if err := json.Unmarshal([]byte(reqHeadersRaw), &headers); err != nil {
		t.Fatalf("parse req_headers JSON: %v", err)
	}

	if headers["Authorization"] != "***" {
		t.Errorf("Authorization header = %q, want %q", headers["Authorization"], "***")
	}
	if headers["Content-Type"] != "application/json" {
		t.Errorf("Content-Type = %q, want %q", headers["Content-Type"], "application/json")
	}
}

func TestApiRequestIngest_BatchLimit(t *testing.T) {
	ts := setupTestServer(t)
	apiKey := createLogServiceForIngest(t, ts, "req-svc-batch")

	// Build 51 entries — over the 50 limit
	entries := make([]map[string]interface{}, 51)
	for i := range entries {
		entries[i] = map[string]interface{}{
			"method":     "GET",
			"path":       "/api/test",
			"statusCode": 200,
			"durationMs": 5,
		}
	}

	resp, result := ts.doRequest(t, "POST", "/api/v1/ingest/requests", map[string]interface{}{
		"requests": entries,
	}, "Authorization", "Bearer "+apiKey)

	if resp.StatusCode != 400 {
		t.Errorf("status = %d, want 400", resp.StatusCode)
	}
	if result.Error == nil || result.Error.Code != "VALIDATION_ERROR" {
		t.Errorf("expected VALIDATION_ERROR, got %v", result.Error)
	}
}

func TestApiRequestIngest_InvalidApiKey(t *testing.T) {
	ts := setupTestServer(t)

	resp, _ := ts.doRequest(t, "POST", "/api/v1/ingest/requests", map[string]interface{}{
		"method":     "GET",
		"path":       "/api/test",
		"statusCode": 200,
		"durationMs": 5,
	}, "Authorization", "Bearer invalid-key-99999")

	if resp.StatusCode != 401 {
		t.Errorf("status = %d, want 401", resp.StatusCode)
	}
}

// ─── API Capture Config Tests ─────────────────────────────────────

func TestApiCaptureConfig_GetAndUpdate(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	// 1. Create a log service
	_, createResult := ts.doRequest(t, "POST", "/api/v1/services", map[string]interface{}{
		"id":   "cfg-svc-1",
		"name": "Config Test Service",
		"type": "log",
	}, auth...)
	if !createResult.Success {
		t.Fatalf("create service failed: %v", createResult.Error)
	}

	// 2. GET defaults — expect mode="sampled", sampleRate=10
	resp, getResult := ts.doRequest(t, "GET", "/api/v1/services/cfg-svc-1/api-capture-config", nil, auth...)
	if resp.StatusCode != 200 {
		t.Errorf("GET status = %d, want 200", resp.StatusCode)
	}
	if !getResult.Success {
		t.Fatalf("GET failed: %v", getResult.Error)
	}

	var cfg struct {
		Mode         string `json:"mode"`
		SampleRate   int    `json:"sampleRate"`
		BodyMaxBytes int    `json:"bodyMaxBytes"`
	}
	json.Unmarshal(getResult.Data, &cfg)
	if cfg.Mode != "sampled" {
		t.Errorf("default mode = %q, want %q", cfg.Mode, "sampled")
	}
	if cfg.SampleRate != 10 {
		t.Errorf("default sampleRate = %d, want 10", cfg.SampleRate)
	}

	// 3. PUT with updated values
	resp, putResult := ts.doRequest(t, "PUT", "/api/v1/services/cfg-svc-1/api-capture-config", map[string]interface{}{
		"mode":             "errors_only",
		"sampleRate":       0,
		"bodyMaxBytes":     4096,
		"maskedHeaders":    []string{"authorization"},
		"maskedBodyFields": []string{"password"},
	}, auth...)
	if resp.StatusCode != 200 {
		t.Errorf("PUT status = %d, want 200", resp.StatusCode)
	}
	if !putResult.Success {
		t.Fatalf("PUT failed: %v", putResult.Error)
	}

	// 4. GET again — verify updated values
	_, getResult2 := ts.doRequest(t, "GET", "/api/v1/services/cfg-svc-1/api-capture-config", nil, auth...)
	if !getResult2.Success {
		t.Fatalf("second GET failed: %v", getResult2.Error)
	}

	var cfg2 struct {
		Mode             string   `json:"mode"`
		SampleRate       int      `json:"sampleRate"`
		BodyMaxBytes     int      `json:"bodyMaxBytes"`
		MaskedHeaders    []string `json:"maskedHeaders"`
		MaskedBodyFields []string `json:"maskedBodyFields"`
	}
	json.Unmarshal(getResult2.Data, &cfg2)
	if cfg2.Mode != "errors_only" {
		t.Errorf("updated mode = %q, want %q", cfg2.Mode, "errors_only")
	}
	if cfg2.SampleRate != 0 {
		t.Errorf("updated sampleRate = %d, want 0", cfg2.SampleRate)
	}
	if cfg2.BodyMaxBytes != 4096 {
		t.Errorf("updated bodyMaxBytes = %d, want 4096", cfg2.BodyMaxBytes)
	}
	if len(cfg2.MaskedHeaders) != 1 || cfg2.MaskedHeaders[0] != "authorization" {
		t.Errorf("updated maskedHeaders = %v, want [authorization]", cfg2.MaskedHeaders)
	}
	if len(cfg2.MaskedBodyFields) != 1 || cfg2.MaskedBodyFields[0] != "password" {
		t.Errorf("updated maskedBodyFields = %v, want [password]", cfg2.MaskedBodyFields)
	}

	// 5. PUT with invalid mode → 400 VALIDATION_ERROR
	resp, errResult := ts.doRequest(t, "PUT", "/api/v1/services/cfg-svc-1/api-capture-config", map[string]interface{}{
		"mode":             "invalid_mode",
		"sampleRate":       10,
		"bodyMaxBytes":     8192,
		"maskedHeaders":    []string{},
		"maskedBodyFields": []string{},
	}, auth...)
	if resp.StatusCode != 400 {
		t.Errorf("invalid mode status = %d, want 400", resp.StatusCode)
	}
	if errResult.Error == nil || errResult.Error.Code != "VALIDATION_ERROR" {
		t.Errorf("expected VALIDATION_ERROR, got %v", errResult.Error)
	}

	// 6. PUT with sampleRate 150 → 400 VALIDATION_ERROR
	resp, errResult2 := ts.doRequest(t, "PUT", "/api/v1/services/cfg-svc-1/api-capture-config", map[string]interface{}{
		"mode":             "sampled",
		"sampleRate":       150,
		"bodyMaxBytes":     8192,
		"maskedHeaders":    []string{},
		"maskedBodyFields": []string{},
	}, auth...)
	if resp.StatusCode != 400 {
		t.Errorf("out-of-range sampleRate status = %d, want 400", resp.StatusCode)
	}
	if errResult2.Error == nil || errResult2.Error.Code != "VALIDATION_ERROR" {
		t.Errorf("expected VALIDATION_ERROR, got %v", errResult2.Error)
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
