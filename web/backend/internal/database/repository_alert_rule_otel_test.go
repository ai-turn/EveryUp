package database_test

import (
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// GetEnabledOtelMetricRules must return global + the exact direct/Agent service
// rules, and exclude disabled rules, other metrics, and sibling targets.
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

	if err := database.NewAgentRepository().UpsertAgent(models.Agent{ID: agentA, Name: "agent A"}); err != nil {
		t.Fatal(err)
	}
	if err := database.NewAgentRepository().UpsertServices(agentA, time.Now(), []models.AgentService{
		{AgentID: agentA, Key: "checkout", Name: "checkout-api", CheckType: "http", Endpoint: "http://checkout"},
		{AgentID: agentA, Key: "billing", Name: "billing-api", CheckType: "http", Endpoint: "http://billing"},
	}); err != nil {
		t.Fatal(err)
	}
	checkoutKey := "checkout"
	billingKey := "billing"
	for _, scoped := range []struct {
		id  string
		key *string
	}{
		{id: "checkout-service", key: &checkoutKey},
		{id: "billing-service", key: &billingKey},
	} {
		rule := &models.AlertRule{
			ID: scoped.id, Name: scoped.id, Type: models.AlertRuleTypeService,
			AgentID: &agentA, ServiceKey: scoped.key,
			Metric: models.AlertMetricOtelMetric, MetricName: "gc.pause", Operator: models.AlertOperatorGT,
			Threshold: 1, Duration: 1, Severity: models.AlertSeverityWarning, IsEnabled: true,
		}
		if err := repo.Create(rule); err != nil {
			t.Fatal(err)
		}
	}

	rules, err := repo.GetEnabledOtelMetricRules("", agentA, "checkout-api")
	if err != nil {
		t.Fatalf("GetEnabledOtelMetricRules: %v", err)
	}
	got := map[string]bool{}
	for _, r := range rules {
		got[r.ID] = true
	}
	if !got["global"] || !got["agentA"] || !got["checkout-service"] {
		t.Fatalf("want global + agentA + checkout service rules, got %v", got)
	}
	if got["agentB"] || got["billing-service"] || got["disabled"] || got["cpu"] {
		t.Fatalf("scoping leaked non-matching rules: %v", got)
	}
	// metricName round-trips through the query.
	for _, r := range rules {
		if r.ID == "global" && r.MetricName != "jvm.memory.used" {
			t.Fatalf("global metricName = %q", r.MetricName)
		}
	}
}
