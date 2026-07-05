package database_test

import (
	"testing"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// GetEnabledOtelMetricRules must return global + this-agent otel_metric rules,
// and exclude disabled rules, other metrics, and other agents' rules.
func TestGetEnabledOtelMetricRules_Scoping(t *testing.T) {
	openTestDB(t)
	repo := database.NewAlertRuleRepository()

	agentA := "agent-a"
	agentB := "agent-b"
	mk := func(id, name string, agentID *string, metric models.AlertMetric, metricName string, enabled bool) {
		rule := &models.AlertRule{
			ID: id, Name: name, Type: models.AlertRuleTypeService, AgentID: agentID,
			Metric: metric, MetricName: metricName, Operator: models.AlertOperatorGT,
			Threshold: 1, Duration: 1, Severity: models.AlertSeverityWarning, IsEnabled: enabled,
		}
		if err := repo.Create(rule); err != nil {
			t.Fatalf("create %s: %v", id, err)
		}
	}

	mk("global", "global metric", nil, models.AlertMetricOtelMetric, "jvm.memory.used", true)
	mk("agentA", "agentA metric", &agentA, models.AlertMetricOtelMetric, "gc.pause", true)
	mk("agentB", "agentB metric", &agentB, models.AlertMetricOtelMetric, "gc.pause", true)
	mk("disabled", "disabled metric", &agentA, models.AlertMetricOtelMetric, "x", false)
	mk("cpu", "cpu rule", &agentA, models.AlertMetricCPU, "", true)

	rules, err := repo.GetEnabledOtelMetricRules(agentA)
	if err != nil {
		t.Fatalf("GetEnabledOtelMetricRules: %v", err)
	}
	got := map[string]bool{}
	for _, r := range rules {
		got[r.ID] = true
	}
	if !got["global"] || !got["agentA"] {
		t.Fatalf("want global + agentA rules, got %v", got)
	}
	if got["agentB"] || got["disabled"] || got["cpu"] {
		t.Fatalf("scoping leaked non-matching rules: %v", got)
	}
	// metricName round-trips through the query.
	for _, r := range rules {
		if r.ID == "global" && r.MetricName != "jvm.memory.used" {
			t.Fatalf("global metricName = %q", r.MetricName)
		}
	}
}
