package database_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// makeTestService creates and inserts a minimal valid service for use in tests.
func makeTestService(t *testing.T, id string) {
	t.Helper()
	repo := database.NewServiceRepository()
	svc := &models.Service{
		ID:        id,
		Name:      "Test Service " + id,
		Type:      models.ServiceTypeHTTP,
		IsActive:  true,
		Interval:  60,
		Timeout:   30,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := repo.Create(svc); err != nil {
		t.Fatalf("failed to create test service %q: %v", id, err)
	}
}

// makeTestRequest returns a sample ApiRequest for insertion tests.
func makeTestRequest(serviceID string, method string, path string, statusCode int, isError bool, createdAt time.Time) models.ApiRequest {
	headers := json.RawMessage(`{"content-type":"application/json"}`)
	return models.ApiRequest{
		ServiceID:    serviceID,
		RequestID:    "req-" + path + "-" + method,
		Method:       method,
		Path:         path,
		PathTemplate: path,
		StatusCode:   statusCode,
		DurationMs:   50,
		ClientIP:     "127.0.0.1",
		ReqHeaders:   headers,
		ReqBody:      `{"key":"value"}`,
		ReqBodySize:  15,
		ResHeaders:   headers,
		ResBody:      `{"ok":true}`,
		ResBodySize:  11,
		IsError:      isError,
		CreatedAt:    createdAt,
	}
}

// --- TestApiRequestRepo_CreateAndGetByID ---

func TestApiRequestRepo_CreateAndGetByID(t *testing.T) {
	openTestDB(t)
	makeTestService(t, "svc-1")

	repo := database.NewApiRequestRepository()
	now := time.Now().Truncate(time.Second)
	req := makeTestRequest("svc-1", "GET", "/users/1", 200, false, now)

	if err := repo.Create(&req); err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	if req.ID == 0 {
		t.Fatal("Create should set req.ID from LastInsertId, got 0")
	}

	got, err := repo.GetByID(req.ID)
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if got == nil {
		t.Fatal("GetByID returned nil, expected record")
	}

	// Verify all fields round-trip correctly.
	if got.ServiceID != req.ServiceID {
		t.Errorf("ServiceID = %q, want %q", got.ServiceID, req.ServiceID)
	}
	if got.RequestID != req.RequestID {
		t.Errorf("RequestID = %q, want %q", got.RequestID, req.RequestID)
	}
	if got.Method != req.Method {
		t.Errorf("Method = %q, want %q", got.Method, req.Method)
	}
	if got.Path != req.Path {
		t.Errorf("Path = %q, want %q", got.Path, req.Path)
	}
	if got.PathTemplate != req.PathTemplate {
		t.Errorf("PathTemplate = %q, want %q", got.PathTemplate, req.PathTemplate)
	}
	if got.StatusCode != req.StatusCode {
		t.Errorf("StatusCode = %d, want %d", got.StatusCode, req.StatusCode)
	}
	if got.DurationMs != req.DurationMs {
		t.Errorf("DurationMs = %d, want %d", got.DurationMs, req.DurationMs)
	}
	if got.ClientIP != req.ClientIP {
		t.Errorf("ClientIP = %q, want %q", got.ClientIP, req.ClientIP)
	}
	if got.ReqBody != req.ReqBody {
		t.Errorf("ReqBody = %q, want %q", got.ReqBody, req.ReqBody)
	}
	if got.ReqBodySize != req.ReqBodySize {
		t.Errorf("ReqBodySize = %d, want %d", got.ReqBodySize, req.ReqBodySize)
	}
	if got.ResBody != req.ResBody {
		t.Errorf("ResBody = %q, want %q", got.ResBody, req.ResBody)
	}
	if got.ResBodySize != req.ResBodySize {
		t.Errorf("ResBodySize = %d, want %d", got.ResBodySize, req.ResBodySize)
	}
	if got.IsError != req.IsError {
		t.Errorf("IsError = %v, want %v", got.IsError, req.IsError)
	}
	if !got.CreatedAt.Equal(now) {
		t.Errorf("CreatedAt = %v, want %v", got.CreatedAt, now)
	}

	// Headers should round-trip as valid JSON.
	if got.ReqHeaders == nil {
		t.Error("ReqHeaders should not be nil")
	}
	if got.ResHeaders == nil {
		t.Error("ResHeaders should not be nil")
	}
}

func TestApiRequestRepo_GetByID_NotFound(t *testing.T) {
	openTestDB(t)

	repo := database.NewApiRequestRepository()
	got, err := repo.GetByID(999999)
	if err != nil {
		t.Fatalf("GetByID not-found should return nil,nil, got err: %v", err)
	}
	if got != nil {
		t.Fatalf("GetByID not-found should return nil, got %+v", got)
	}
}

// --- TestApiRequestRepo_CreateBatch ---

func TestApiRequestRepo_CreateBatch(t *testing.T) {
	openTestDB(t)
	makeTestService(t, "svc-batch")

	repo := database.NewApiRequestRepository()
	now := time.Now()

	reqs := []models.ApiRequest{
		makeTestRequest("svc-batch", "GET", "/a", 200, false, now),
		makeTestRequest("svc-batch", "POST", "/b", 201, false, now),
		makeTestRequest("svc-batch", "DELETE", "/c", 500, true, now),
	}

	count, err := repo.CreateBatch(reqs)
	if err != nil {
		t.Fatalf("CreateBatch failed: %v", err)
	}
	if count != 3 {
		t.Errorf("CreateBatch returned count = %d, want 3", count)
	}

	// List should return all 3.
	items, total, err := repo.List(&models.ApiRequestFilter{ServiceID: "svc-batch"})
	if err != nil {
		t.Fatalf("List after CreateBatch failed: %v", err)
	}
	if total != 3 {
		t.Errorf("total = %d, want 3", total)
	}
	if len(items) != 3 {
		t.Errorf("len(items) = %d, want 3", len(items))
	}
}

// --- TestApiRequestRepo_ListFilters ---

func TestApiRequestRepo_ListFilters(t *testing.T) {
	openTestDB(t)
	makeTestService(t, "svc-filter")

	repo := database.NewApiRequestRepository()
	base := time.Now().Add(-time.Hour)

	// Insert 5 rows: 2×200, 1×400 error, 1×404 error, 1×500 error
	rows := []models.ApiRequest{
		makeTestRequest("svc-filter", "GET", "/users", 200, false, base),
		makeTestRequest("svc-filter", "POST", "/users", 200, false, base.Add(time.Second)),
		makeTestRequest("svc-filter", "GET", "/users/bad", 400, true, base.Add(2*time.Second)),
		makeTestRequest("svc-filter", "GET", "/items/1", 404, true, base.Add(3*time.Second)),
		makeTestRequest("svc-filter", "POST", "/items", 500, true, base.Add(4*time.Second)),
	}
	_, err := repo.CreateBatch(rows)
	if err != nil {
		t.Fatalf("setup CreateBatch: %v", err)
	}

	t.Run("ErrorsOnly", func(t *testing.T) {
		items, total, err := repo.List(&models.ApiRequestFilter{
			ServiceID:  "svc-filter",
			ErrorsOnly: true,
		})
		if err != nil {
			t.Fatalf("List ErrorsOnly: %v", err)
		}
		if total != 3 {
			t.Errorf("total = %d, want 3", total)
		}
		for _, it := range items {
			if !it.IsError {
				t.Errorf("got non-error row in ErrorsOnly result: %+v", it)
			}
		}
	})

	t.Run("MinStatus400", func(t *testing.T) {
		items, total, err := repo.List(&models.ApiRequestFilter{
			ServiceID: "svc-filter",
			MinStatus: 400,
		})
		if err != nil {
			t.Fatalf("List MinStatus=400: %v", err)
		}
		if total != 3 {
			t.Errorf("total = %d, want 3 (400, 404, 500)", total)
		}
		for _, it := range items {
			if it.StatusCode < 400 {
				t.Errorf("got status %d below min 400", it.StatusCode)
			}
		}
	})

	t.Run("PathPrefix_users", func(t *testing.T) {
		items, total, err := repo.List(&models.ApiRequestFilter{
			ServiceID:  "svc-filter",
			PathPrefix: "/users",
		})
		if err != nil {
			t.Fatalf("List PathPrefix=/users: %v", err)
		}
		if total != 3 {
			t.Errorf("total = %d, want 3 (/users, /users, /users/bad)", total)
		}
		for _, it := range items {
			if len(it.Path) < 6 || it.Path[:6] != "/users" {
				t.Errorf("path %q does not start with /users", it.Path)
			}
		}
	})

	t.Run("Pagination_Limit2Offset0", func(t *testing.T) {
		items, total, err := repo.List(&models.ApiRequestFilter{
			ServiceID: "svc-filter",
			Limit:     2,
			Offset:    0,
		})
		if err != nil {
			t.Fatalf("List Limit=2: %v", err)
		}
		if total != 5 {
			t.Errorf("total = %d, want 5 (all rows)", total)
		}
		if len(items) != 2 {
			t.Errorf("len(items) = %d, want 2", len(items))
		}
	})

	t.Run("Methods_GET", func(t *testing.T) {
		items, total, err := repo.List(&models.ApiRequestFilter{
			ServiceID: "svc-filter",
			Methods:   []string{"GET"},
		})
		if err != nil {
			t.Fatalf("List Methods=GET: %v", err)
		}
		if total != 3 {
			t.Errorf("total = %d, want 3 GET rows", total)
		}
		for _, it := range items {
			if it.Method != "GET" {
				t.Errorf("got method %q, want GET", it.Method)
			}
		}
	})
}

// --- TestApiRequestRepo_DeleteOlderThan ---

func TestApiRequestRepo_DeleteOlderThan(t *testing.T) {
	openTestDB(t)
	makeTestService(t, "svc-del")

	repo := database.NewApiRequestRepository()
	past := time.Now().Add(-2 * time.Hour)
	future := time.Now().Add(time.Hour)

	reqs := []models.ApiRequest{
		makeTestRequest("svc-del", "GET", "/old1", 200, false, past),
		makeTestRequest("svc-del", "GET", "/old2", 200, false, past.Add(time.Minute)),
		makeTestRequest("svc-del", "GET", "/old3", 200, false, past.Add(2*time.Minute)),
		makeTestRequest("svc-del", "GET", "/new1", 200, false, future),
	}
	_, err := repo.CreateBatch(reqs)
	if err != nil {
		t.Fatalf("setup CreateBatch: %v", err)
	}

	affected, err := repo.DeleteOlderThan(time.Now())
	if err != nil {
		t.Fatalf("DeleteOlderThan: %v", err)
	}
	if affected != 3 {
		t.Errorf("DeleteOlderThan affected = %d, want 3", affected)
	}

	// Only the future row should remain.
	items, total, err := repo.List(&models.ApiRequestFilter{ServiceID: "svc-del"})
	if err != nil {
		t.Fatalf("List after delete: %v", err)
	}
	if total != 1 {
		t.Errorf("total after delete = %d, want 1", total)
	}
	if len(items) != 1 || items[0].Path != "/new1" {
		t.Errorf("remaining item = %+v, want path=/new1", items)
	}
}

// --- TestServiceRepo_ApiCaptureConfig_DefaultsAndUpdate ---

func TestServiceRepo_ApiCaptureConfig_DefaultsAndUpdate(t *testing.T) {
	openTestDB(t)
	makeTestService(t, "svc-cap")

	svcRepo := database.NewServiceRepository()

	// 1. GetApiCaptureConfig on a service with all-NULL capture columns → defaults.
	cfg, err := svcRepo.GetApiCaptureConfig("svc-cap")
	if err != nil {
		t.Fatalf("GetApiCaptureConfig: %v", err)
	}
	defaults := models.DefaultApiCaptureConfig()
	if cfg.Mode != defaults.Mode {
		t.Errorf("Mode = %q, want default %q", cfg.Mode, defaults.Mode)
	}
	if cfg.SampleRate != defaults.SampleRate {
		t.Errorf("SampleRate = %d, want default %d", cfg.SampleRate, defaults.SampleRate)
	}
	if cfg.BodyMaxBytes != defaults.BodyMaxBytes {
		t.Errorf("BodyMaxBytes = %d, want default %d", cfg.BodyMaxBytes, defaults.BodyMaxBytes)
	}

	// 2. UpdateApiCaptureConfig with custom values.
	custom := models.ApiCaptureConfig{
		Mode:             models.CaptureModeAll,
		SampleRate:       50,
		BodyMaxBytes:     4096,
		MaskedHeaders:    []string{"x-auth-token", "x-secret"},
		MaskedBodyFields: []string{"password", "ssn"},
	}
	if err := svcRepo.UpdateApiCaptureConfig("svc-cap", &custom); err != nil {
		t.Fatalf("UpdateApiCaptureConfig: %v", err)
	}

	// 3. GetApiCaptureConfig should return the updated values.
	got, err := svcRepo.GetApiCaptureConfig("svc-cap")
	if err != nil {
		t.Fatalf("GetApiCaptureConfig after update: %v", err)
	}
	if got.Mode != custom.Mode {
		t.Errorf("Mode = %q, want %q", got.Mode, custom.Mode)
	}
	if got.SampleRate != custom.SampleRate {
		t.Errorf("SampleRate = %d, want %d", got.SampleRate, custom.SampleRate)
	}
	if got.BodyMaxBytes != custom.BodyMaxBytes {
		t.Errorf("BodyMaxBytes = %d, want %d", got.BodyMaxBytes, custom.BodyMaxBytes)
	}

	// 4. MaskedHeaders round-trip through comma-separated storage.
	if len(got.MaskedHeaders) != len(custom.MaskedHeaders) {
		t.Errorf("MaskedHeaders len = %d, want %d", len(got.MaskedHeaders), len(custom.MaskedHeaders))
	} else {
		for i, h := range custom.MaskedHeaders {
			if got.MaskedHeaders[i] != h {
				t.Errorf("MaskedHeaders[%d] = %q, want %q", i, got.MaskedHeaders[i], h)
			}
		}
	}

	// 5. MaskedBodyFields round-trip.
	if len(got.MaskedBodyFields) != len(custom.MaskedBodyFields) {
		t.Errorf("MaskedBodyFields len = %d, want %d", len(got.MaskedBodyFields), len(custom.MaskedBodyFields))
	} else {
		for i, f := range custom.MaskedBodyFields {
			if got.MaskedBodyFields[i] != f {
				t.Errorf("MaskedBodyFields[%d] = %q, want %q", i, got.MaskedBodyFields[i], f)
			}
		}
	}
}

// --- TestApiRequestRepo_ListFilterExtended ---

func TestApiRequestRepo_ListFilterExtended(t *testing.T) {
	t.Run("Search_reqBody", func(t *testing.T) {
		openTestDB(t)
		makeTestService(t, "svc-search")

		repo := database.NewApiRequestRepository()
		now := time.Now()

		// Row with alice in req_body.
		r1 := makeTestRequest("svc-search", "POST", "/submit", 200, false, now)
		r1.ReqBody = `{"user":"alice"}`
		if err := repo.Create(&r1); err != nil {
			t.Fatalf("Create r1: %v", err)
		}

		// Row with /search/foo in path.
		r2 := makeTestRequest("svc-search", "GET", "/search/foo", 200, false, now.Add(time.Second))
		r2.ReqBody = `{"key":"value"}`
		if err := repo.Create(&r2); err != nil {
			t.Fatalf("Create r2: %v", err)
		}

		// Search for "alice" — should match r1 via req_body.
		items, total, err := repo.List(&models.ApiRequestFilter{
			ServiceID: "svc-search",
			Search:    "alice",
		})
		if err != nil {
			t.Fatalf("List Search=alice: %v", err)
		}
		if total != 1 {
			t.Errorf("Search=alice: total = %d, want 1", total)
		}
		if len(items) == 1 && items[0].Path != "/submit" {
			t.Errorf("Search=alice: got path %q, want /submit", items[0].Path)
		}

		// Search for "foo" — should match r2 via path.
		items2, total2, err := repo.List(&models.ApiRequestFilter{
			ServiceID: "svc-search",
			Search:    "foo",
		})
		if err != nil {
			t.Fatalf("List Search=foo: %v", err)
		}
		if total2 != 1 {
			t.Errorf("Search=foo: total = %d, want 1", total2)
		}
		if len(items2) == 1 && items2[0].Path != "/search/foo" {
			t.Errorf("Search=foo: got path %q, want /search/foo", items2[0].Path)
		}
	})

	t.Run("MaxStatus", func(t *testing.T) {
		openTestDB(t)
		makeTestService(t, "svc-maxstatus")

		repo := database.NewApiRequestRepository()
		now := time.Now()

		reqs := []models.ApiRequest{
			makeTestRequest("svc-maxstatus", "GET", "/a", 200, false, now),
			makeTestRequest("svc-maxstatus", "GET", "/b", 301, false, now.Add(time.Second)),
			makeTestRequest("svc-maxstatus", "GET", "/c", 404, true, now.Add(2*time.Second)),
		}
		if _, err := repo.CreateBatch(reqs); err != nil {
			t.Fatalf("CreateBatch: %v", err)
		}

		// MaxStatus=399 → 200 and 301 qualify.
		items, total, err := repo.List(&models.ApiRequestFilter{
			ServiceID: "svc-maxstatus",
			MaxStatus: 399,
		})
		if err != nil {
			t.Fatalf("List MaxStatus=399: %v", err)
		}
		if total != 2 {
			t.Errorf("MaxStatus=399: total = %d, want 2 (200, 301)", total)
		}
		for _, it := range items {
			if it.StatusCode > 399 {
				t.Errorf("MaxStatus=399: got status %d above max", it.StatusCode)
			}
		}

		// MinStatus=200, MaxStatus=299 → only 200 qualifies.
		items2, total2, err := repo.List(&models.ApiRequestFilter{
			ServiceID: "svc-maxstatus",
			MinStatus: 200,
			MaxStatus: 299,
		})
		if err != nil {
			t.Fatalf("List MinStatus=200 MaxStatus=299: %v", err)
		}
		if total2 != 1 {
			t.Errorf("MinStatus=200 MaxStatus=299: total = %d, want 1 (200 only)", total2)
		}
		if len(items2) == 1 && items2[0].StatusCode != 200 {
			t.Errorf("MinStatus=200 MaxStatus=299: got status %d, want 200", items2[0].StatusCode)
		}
	})

	t.Run("FromTo_time", func(t *testing.T) {
		openTestDB(t)
		makeTestService(t, "svc-fromto")

		now := time.Now().Truncate(time.Second)
		tMinus2h := now.Add(-2 * time.Hour)
		tMinus1h := now.Add(-time.Hour)
		tPlus1h := now.Add(time.Hour)

		// Insert directly with controlled created_at values.
		for _, row := range []struct {
			path      string
			createdAt time.Time
		}{
			{"/old", tMinus2h},
			{"/mid", tMinus1h},
			{"/new", tPlus1h},
		} {
			_, err := database.DB.Exec(`
				INSERT INTO api_requests
					(service_id, request_id, method, path, path_template,
					 status_code, duration_ms, client_ip,
					 req_body, req_body_size, res_body, res_body_size,
					 is_error, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				"svc-fromto", "req-"+row.path, "GET", row.path, row.path,
				200, 10, "127.0.0.1",
				"", 0, "", 0,
				0, row.createdAt,
			)
			if err != nil {
				t.Fatalf("INSERT %s: %v", row.path, err)
			}
		}

		repo := database.NewApiRequestRepository()

		// From=t-90min, To=t+2h → should return /mid (t-1h) and /new (t+1h).
		from90 := now.Add(-90 * time.Minute)
		toPlus2h := now.Add(2 * time.Hour)
		items, total, err := repo.List(&models.ApiRequestFilter{
			ServiceID: "svc-fromto",
			From:      from90,
			To:        toPlus2h,
		})
		if err != nil {
			t.Fatalf("List From/To: %v", err)
		}
		if total != 2 {
			t.Errorf("From=-90min To=+2h: total = %d, want 2 (/mid, /new)", total)
		}

		// To=now → should return /old (t-2h) and /mid (t-1h).
		items2, total2, err := repo.List(&models.ApiRequestFilter{
			ServiceID: "svc-fromto",
			To:        now,
		})
		if err != nil {
			t.Fatalf("List To=now: %v", err)
		}
		if total2 != 2 {
			t.Errorf("To=now: total = %d, want 2 (/old, /mid)", total2)
		}
		_ = items
		_ = items2
	})
}

func TestServiceRepo_ApiCaptureConfig_EmptyMaskedLists(t *testing.T) {
	openTestDB(t)
	makeTestService(t, "svc-empty")

	svcRepo := database.NewServiceRepository()

	// Update with empty masked lists.
	cfg := models.ApiCaptureConfig{
		Mode:             models.CaptureModeDisabled,
		SampleRate:       0,
		BodyMaxBytes:     0,
		MaskedHeaders:    nil,
		MaskedBodyFields: nil,
	}
	if err := svcRepo.UpdateApiCaptureConfig("svc-empty", &cfg); err != nil {
		t.Fatalf("UpdateApiCaptureConfig: %v", err)
	}

	got, err := svcRepo.GetApiCaptureConfig("svc-empty")
	if err != nil {
		t.Fatalf("GetApiCaptureConfig: %v", err)
	}
	if got.Mode != models.CaptureModeDisabled {
		t.Errorf("Mode = %q, want disabled", got.Mode)
	}
	if len(got.MaskedHeaders) != 0 {
		t.Errorf("MaskedHeaders = %v, want empty", got.MaskedHeaders)
	}
	if len(got.MaskedBodyFields) != 0 {
		t.Errorf("MaskedBodyFields = %v, want empty", got.MaskedBodyFields)
	}
}
