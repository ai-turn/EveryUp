package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestIndependentTCPMonitorLifecycle(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	_, createResult := ts.doRequest(t, "POST", "/api/v1/services", map[string]interface{}{
		"name":     "public-tcp",
		"type":     "tcp",
		"host":     "1.1.1.1",
		"port":     1,
		"timeout":  50,
		"interval": 5,
	}, auth...)
	if !createResult.Success {
		t.Fatalf("create monitor failed: %v", createResult.Error)
	}
	var created struct {
		ID       string `json:"id"`
		IsActive bool   `json:"isActive"`
	}
	if err := json.Unmarshal(createResult.Data, &created); err != nil {
		t.Fatal(err)
	}
	if created.ID == "" || !created.IsActive {
		t.Fatalf("unexpected created monitor: %+v", created)
	}

	var checked struct {
		LastCheckAt *time.Time `json:"lastCheckAt"`
	}
	for range 20 {
		_, getResult := ts.doRequest(t, "GET", "/api/v1/services/"+created.ID, nil, auth...)
		if !getResult.Success {
			t.Fatalf("get monitor failed: %v", getResult.Error)
		}
		if err := json.Unmarshal(getResult.Data, &checked); err != nil {
			t.Fatal(err)
		}
		if checked.LastCheckAt != nil {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if checked.LastCheckAt == nil {
		t.Fatal("new monitor did not run an immediate check")
	}

	_, pauseResult := ts.doRequest(t, "PUT", "/api/v1/services/"+created.ID, map[string]interface{}{
		"name":     "public-tcp",
		"type":     "tcp",
		"host":     "1.1.1.1",
		"port":     1,
		"timeout":  50,
		"interval": 5,
		"isActive": false,
	}, auth...)
	if !pauseResult.Success {
		t.Fatalf("pause monitor failed: %v", pauseResult.Error)
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/v1/services/"+created.ID, nil)
	deleteReq.Header.Set("Authorization", "Bearer "+token)
	deleteResp, err := ts.App.Test(deleteReq)
	if err != nil {
		t.Fatal(err)
	}
	defer deleteResp.Body.Close()
	if deleteResp.StatusCode != http.StatusNoContent {
		t.Fatalf("delete monitor status=%d, want 204", deleteResp.StatusCode)
	}
}

func TestIndependentMonitorRejectsPrivateTarget(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	_, result := ts.doRequest(t, "POST", "/api/v1/services", map[string]interface{}{
		"name": "private-target",
		"type": "tcp",
		"host": "127.0.0.1",
		"port": 8080,
	}, authHeader(token)...)
	if result.Success || result.Error == nil || result.Error.Code != "VALIDATION_ERROR" {
		t.Fatalf("private target must be rejected, got %+v", result)
	}
}
