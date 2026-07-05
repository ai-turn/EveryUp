package handlers_test

import (
	"encoding/json"
	"testing"

	"github.com/aiturn/everyup/internal/models"
)

// The otel_metric rule type must round-trip metricName through create → list,
// and reject creation when metricName is missing.
func TestOtelMetricAlertRule_CRUDCarriesMetricName(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	// Missing metricName → 400.
	resp, res := ts.doRequest(t, "POST", "/api/v1/alert-rules", map[string]interface{}{
		"name": "mem", "type": "service", "metric": "otel_metric",
		"operator": "gt", "threshold": 500,
	}, auth...)
	if resp.StatusCode != 400 || res.Success {
		t.Fatalf("otel_metric rule without metricName should 400, got %d", resp.StatusCode)
	}

	// Valid create.
	_, createRes := ts.doRequest(t, "POST", "/api/v1/alert-rules", map[string]interface{}{
		"name": "jvm heap high", "type": "service", "metric": "otel_metric",
		"metricName": "jvm.memory.used", "operator": "gt", "threshold": 500,
		"severity": "warning", "cooldown": 300,
	}, auth...)
	if !createRes.Success {
		t.Fatalf("create otel_metric rule failed: %v", createRes.Error)
	}

	// List back and confirm metricName persisted.
	_, listRes := ts.doRequest(t, "GET", "/api/v1/alert-rules", nil, auth...)
	if !listRes.Success {
		t.Fatalf("list rules failed: %v", listRes.Error)
	}
	var rules []models.AlertRule
	if err := json.Unmarshal(listRes.Data, &rules); err != nil {
		t.Fatalf("decode rules: %v", err)
	}
	var found *models.AlertRule
	for i := range rules {
		if rules[i].Metric == models.AlertMetricOtelMetric {
			found = &rules[i]
			break
		}
	}
	if found == nil {
		t.Fatal("otel_metric rule not returned in list")
	}
	if found.MetricName != "jvm.memory.used" {
		t.Fatalf("metricName = %q, want jvm.memory.used", found.MetricName)
	}
}
