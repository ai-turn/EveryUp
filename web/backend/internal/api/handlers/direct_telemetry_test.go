package handlers_test

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/aiturn/everyup/internal/database"
	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	collectormetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
)

func TestDirectTelemetryCredentialLifecycleAndSignalScope(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	_, projectResult := ts.doRequest(t, "POST", "/api/v1/projects", map[string]interface{}{
		"name": "payments",
	}, auth...)
	if !projectResult.Success {
		t.Fatalf("create project: %+v", projectResult.Error)
	}
	var project struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(projectResult.Data, &project); err != nil {
		t.Fatal(err)
	}

	_, createResult := ts.doRequest(t, "POST", "/api/v1/observed-services", map[string]interface{}{
		"name":      "checkout-api",
		"projectId": project.ID,
		"signals":   []string{"logs"},
	}, auth...)
	if !createResult.Success {
		t.Fatalf("create direct observed service: %+v", createResult.Error)
	}
	var created struct {
		ID        string   `json:"id"`
		Name      string   `json:"name"`
		ProjectID string   `json:"projectId"`
		Signals   []string `json:"signals"`
		ApiKey    string   `json:"apiKey"`
		IsActive  bool     `json:"isActive"`
	}
	if err := json.Unmarshal(createResult.Data, &created); err != nil {
		t.Fatal(err)
	}
	if created.ID == "" || created.ApiKey == "" || !created.IsActive {
		t.Fatalf("unexpected direct setup: %+v", created)
	}
	if created.ProjectID != project.ID || len(created.Signals) != 1 || created.Signals[0] != "logs" {
		t.Fatalf("unexpected direct target scope: %+v", created)
	}

	_, listResult := ts.doRequest(t, "GET", "/api/v1/observed-services?signal=logs", nil, auth...)
	if !listResult.Success {
		t.Fatalf("list direct observed services: %+v", listResult.Error)
	}
	var listed []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if err := json.Unmarshal(listResult.Data, &listed); err != nil {
		t.Fatal(err)
	}
	if len(listed) != 1 || listed[0].ID != created.ID || listed[0].Name != created.Name {
		t.Fatalf("unexpected direct observed service list: %+v", listed)
	}

	var agentCount int
	if err := database.DB.QueryRow(`SELECT COUNT(*) FROM agents`).Scan(&agentCount); err != nil {
		t.Fatal(err)
	}
	if agentCount != 0 {
		t.Fatalf("direct setup created %d Agent rows, want 0", agentCount)
	}

	logReq := &collectorlogspb.ExportLogsServiceRequest{
		ResourceLogs: []*logspb.ResourceLogs{{
			Resource: &resourcepb.Resource{Attributes: []*commonpb.KeyValue{{
				Key: "service.name", Value: stringValue("payload-controlled-name"),
			}}},
			ScopeLogs: []*logspb.ScopeLogs{{LogRecords: []*logspb.LogRecord{{
				SeverityNumber: logspb.SeverityNumber_SEVERITY_NUMBER_INFO,
				Body:           stringValue("direct log"),
			}}}},
		}},
	}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/logs", created.ApiKey, logReq); status != 200 {
		t.Fatalf("direct logs status=%d, want 200", status)
	}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/metrics", created.ApiKey, &collectormetricspb.ExportMetricsServiceRequest{}); status != 403 {
		t.Fatalf("logs-scoped key metrics status=%d, want 403", status)
	}

	_, filterResult := ts.doRequest(t, "GET", "/api/v1/observed-services/"+created.ID+"/log-filter", nil, auth...)
	var defaultFilter struct {
		Levels []string `json:"levels"`
	}
	if err := json.Unmarshal(filterResult.Data, &defaultFilter); err != nil {
		t.Fatal(err)
	}
	if len(defaultFilter.Levels) != 3 {
		t.Fatalf("default direct log filter = %v, want error/warn/info", defaultFilter.Levels)
	}

	_, logsResult := ts.doRequest(t, "GET", "/api/v1/observed-services/"+created.ID+"/logs", nil, auth...)
	var directLogs struct {
		Data []struct {
			Message string `json:"message"`
		} `json:"data"`
		Total int `json:"total"`
	}
	if err := json.Unmarshal(logsResult.Data, &directLogs); err != nil {
		t.Fatal(err)
	}
	if directLogs.Total != 1 || len(directLogs.Data) != 1 || directLogs.Data[0].Message != "direct log" {
		t.Fatalf("unexpected direct log list: %+v", directLogs)
	}

	_, setFilterResult := ts.doRequest(t, "PUT", "/api/v1/observed-services/"+created.ID+"/log-filter", map[string]interface{}{
		"levels": []string{"debug"},
	}, auth...)
	if !setFilterResult.Success {
		t.Fatalf("set direct log filter: %+v", setFilterResult.Error)
	}
	// The endpoint accepts the payload but the direct connection drops levels
	// outside its configured ingest filter.
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/logs", created.ApiKey, logReq); status != 200 {
		t.Fatalf("filtered direct info log status=%d, want 200", status)
	}
	debugReq := &collectorlogspb.ExportLogsServiceRequest{
		ResourceLogs: []*logspb.ResourceLogs{{
			Resource: &resourcepb.Resource{Attributes: []*commonpb.KeyValue{{
				Key: "service.name", Value: stringValue("another-spoofed-name"),
			}}},
			ScopeLogs: []*logspb.ScopeLogs{{LogRecords: []*logspb.LogRecord{{
				SeverityNumber: logspb.SeverityNumber_SEVERITY_NUMBER_DEBUG,
				Body:           stringValue("direct debug log"),
			}}}},
		}},
	}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/logs", created.ApiKey, debugReq); status != 200 {
		t.Fatalf("allowed direct debug log status=%d, want 200", status)
	}
	_, filteredLogsResult := ts.doRequest(t, "GET", "/api/v1/observed-services/"+created.ID+"/logs", nil, auth...)
	if err := json.Unmarshal(filteredLogsResult.Data, &directLogs); err != nil {
		t.Fatal(err)
	}
	if directLogs.Total != 2 {
		t.Fatalf("direct log total after filter = %d, want 2", directLogs.Total)
	}

	_, alertResult := ts.doRequest(t, "POST", "/api/v1/alert-rules", map[string]interface{}{
		"name":      "direct log errors",
		"type":      "log",
		"serviceId": created.ID,
		"metric":    "log_level",
		"operator":  "gte",
		"threshold": 3,
	}, auth...)
	if !alertResult.Success {
		t.Fatalf("create direct log alert rule: %+v", alertResult.Error)
	}
	var alertRule struct {
		ID        string `json:"id"`
		ServiceID string `json:"serviceId"`
	}
	if err := json.Unmarshal(alertResult.Data, &alertRule); err != nil {
		t.Fatal(err)
	}
	if alertRule.ID == "" || alertRule.ServiceID != created.ID {
		t.Fatalf("unexpected direct log alert rule: %+v", alertRule)
	}
	rules, err := database.NewAlertRuleRepository().GetEnabledLogRules(created.ID, "", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(rules) != 1 || rules[0].ID != alertRule.ID {
		t.Fatalf("direct target alert selection = %+v", rules)
	}
	otherRules, err := database.NewAlertRuleRepository().GetEnabledLogRules("different-service", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(otherRules) != 0 {
		t.Fatalf("direct target alert leaked to another service: %+v", otherRules)
	}

	var storedServiceID, storedServiceName string
	if err := database.DB.QueryRow(`SELECT service_id, service_name FROM logs WHERE message = 'direct log'`).Scan(&storedServiceID, &storedServiceName); err != nil {
		t.Fatal(err)
	}
	if storedServiceID != created.ID || storedServiceName != created.Name {
		t.Fatalf("direct identity = (%q, %q), want (%q, %q)", storedServiceID, storedServiceName, created.ID, created.Name)
	}

	_, projectsResult := ts.doRequest(t, "GET", "/api/v1/projects", nil, auth...)
	var projects []struct {
		ID                   string `json:"id"`
		ObservedServiceCount int    `json:"observedServiceCount"`
	}
	if err := json.Unmarshal(projectsResult.Data, &projects); err != nil {
		t.Fatal(err)
	}
	if len(projects) != 1 || projects[0].ObservedServiceCount != 1 {
		t.Fatalf("project direct target count: %+v", projects)
	}

	_, secondProjectResult := ts.doRequest(t, "POST", "/api/v1/projects", map[string]interface{}{
		"name": "platform",
	}, auth...)
	var secondProject struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(secondProjectResult.Data, &secondProject); err != nil {
		t.Fatal(err)
	}
	_, updateResult := ts.doRequest(t, "PUT", "/api/v1/observed-services/"+created.ID, map[string]interface{}{
		"name":      created.Name,
		"projectId": secondProject.ID,
		"signals":   []string{"logs"},
	}, auth...)
	if !updateResult.Success {
		t.Fatalf("reassign direct observed service: %+v", updateResult.Error)
	}
	var reassigned struct {
		ProjectID string `json:"projectId"`
	}
	if err := json.Unmarshal(updateResult.Data, &reassigned); err != nil {
		t.Fatal(err)
	}
	if reassigned.ProjectID != secondProject.ID {
		t.Fatalf("reassigned project = %q, want %q", reassigned.ProjectID, secondProject.ID)
	}

	_, rotateResult := ts.doRequest(t, "POST", "/api/v1/observed-services/"+created.ID+"/rotate-key", nil, auth...)
	if !rotateResult.Success {
		t.Fatalf("rotate direct key: %+v", rotateResult.Error)
	}
	var rotated struct {
		ApiKey string `json:"apiKey"`
	}
	if err := json.Unmarshal(rotateResult.Data, &rotated); err != nil {
		t.Fatal(err)
	}
	if rotated.ApiKey == "" || rotated.ApiKey == created.ApiKey {
		t.Fatalf("rotation did not return a new key")
	}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/logs", created.ApiKey, logReq); status != 401 {
		t.Fatalf("old key status=%d after rotation, want 401", status)
	}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/logs", rotated.ApiKey, logReq); status != 200 {
		t.Fatalf("rotated key status=%d, want 200", status)
	}

	_, revokeResult := ts.doRequest(t, "POST", "/api/v1/observed-services/"+created.ID+"/revoke-key", nil, auth...)
	if !revokeResult.Success {
		t.Fatalf("revoke direct key: %+v", revokeResult.Error)
	}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/logs", rotated.ApiKey, logReq); status != 403 {
		t.Fatalf("revoked key status=%d, want 403", status)
	}

	deleteRequest := httptest.NewRequest("DELETE", "/api/v1/observed-services/"+created.ID, nil)
	deleteRequest.Header.Set(auth[0], auth[1])
	deleteResponse, err := ts.App.Test(deleteRequest, -1)
	if err != nil {
		t.Fatal(err)
	}
	deleteResponse.Body.Close()
	if deleteResponse.StatusCode != 204 {
		t.Fatalf("delete direct observed service status=%d, want 204", deleteResponse.StatusCode)
	}
	for table, column := range map[string]string{
		"observed_services": "id",
		"logs":              "service_id",
		"alert_rules":       "service_id",
	} {
		var count int
		if err := database.DB.QueryRow("SELECT COUNT(*) FROM "+table+" WHERE "+column+" = ?", created.ID).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count != 0 {
			t.Fatalf("%s rows after direct target deletion = %d, want 0", table, count)
		}
	}
}
