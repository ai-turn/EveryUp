package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestProjectGroupsAgentsAndIndependentMonitors(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	_, projectResult := ts.doRequest(t, "POST", "/api/v1/projects", map[string]string{
		"name": "Production", "description": "customer-facing workloads",
	}, auth...)
	if !projectResult.Success {
		t.Fatalf("create project: %+v", projectResult.Error)
	}
	var project struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(projectResult.Data, &project); err != nil || project.ID == "" {
		t.Fatalf("invalid project response: %v, %s", err, projectResult.Data)
	}

	_, agentResult := ts.doRequest(t, "POST", "/api/v1/agents", map[string]interface{}{
		"name": "prod-host", "profile": map[string]interface{}{"kind": "custom", "capabilities": []string{"infrastructure"}},
	}, auth...)
	if !agentResult.Success {
		t.Fatalf("create agent: %+v", agentResult.Error)
	}
	var agent struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(agentResult.Data, &agent); err != nil || agent.ID == "" {
		t.Fatalf("invalid agent response: %v, %s", err, agentResult.Data)
	}

	_, monitorResult := ts.doRequest(t, "POST", "/api/v1/services", map[string]interface{}{
		"name": "public-dns", "type": "tcp", "host": "1.1.1.1", "port": 53, "interval": 5,
	}, auth...)
	if !monitorResult.Success {
		t.Fatalf("create monitor: %+v", monitorResult.Error)
	}
	var monitor struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(monitorResult.Data, &monitor); err != nil || monitor.ID == "" {
		t.Fatalf("invalid monitor response: %v, %s", err, monitorResult.Data)
	}

	for _, endpoint := range []string{
		"/api/v1/projects/" + project.ID + "/agents/" + agent.ID,
		"/api/v1/projects/" + project.ID + "/monitors/" + monitor.ID,
	} {
		_, result := ts.doRequest(t, "PUT", endpoint, nil, auth...)
		if !result.Success {
			t.Fatalf("assign %s: %+v", endpoint, result.Error)
		}
	}

	_, listResult := ts.doRequest(t, "GET", "/api/v1/projects", nil, auth...)
	if !listResult.Success {
		t.Fatalf("list projects: %+v", listResult.Error)
	}
	var projects []struct {
		ID           string `json:"id"`
		AgentCount   int    `json:"agentCount"`
		MonitorCount int    `json:"monitorCount"`
	}
	if err := json.Unmarshal(listResult.Data, &projects); err != nil {
		t.Fatal(err)
	}
	if len(projects) != 1 || projects[0].ID != project.ID || projects[0].AgentCount != 1 || projects[0].MonitorCount != 1 {
		t.Fatalf("unexpected project rollup: %+v", projects)
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/v1/projects/"+project.ID, nil)
	deleteReq.Header.Set("Authorization", "Bearer "+token)
	deleteResp, err := ts.App.Test(deleteReq)
	if err != nil {
		t.Fatal(err)
	}
	defer deleteResp.Body.Close()
	if deleteResp.StatusCode != http.StatusNoContent {
		t.Fatalf("delete project status=%d, want 204", deleteResp.StatusCode)
	}

	_, agentsResult := ts.doRequest(t, "GET", "/api/v1/agents", nil, auth...)
	var agents []struct {
		ID        string `json:"id"`
		ProjectID string `json:"projectId"`
	}
	if err := json.Unmarshal(agentsResult.Data, &agents); err != nil {
		t.Fatal(err)
	}
	if len(agents) != 1 || agents[0].ProjectID != "" {
		t.Fatalf("project deletion must leave agent unassigned: %+v", agents)
	}
}
