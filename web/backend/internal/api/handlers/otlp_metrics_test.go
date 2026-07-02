package handlers_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	collectormetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
)

// TestOTLPIngest_MetricsStoredAndListed verifies the metrics path end to end:
// the agent key authenticates POST /otlp/v1/metrics, gauge and histogram points
// are flattened into otel_metrics under (agent_id, service_name), and the agent
// service endpoints list the metric names and data points back.
func TestOTLPIngest_MetricsStoredAndListed(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	_, created := ts.doRequest(t, "POST", "/api/v1/agents", map[string]string{"name": "proj-m"}, auth...)
	var agent struct {
		ID     string `json:"id"`
		APIKey string `json:"apiKey"`
	}
	if err := json.Unmarshal(created.Data, &agent); err != nil {
		t.Fatalf("decode agent: %v", err)
	}

	const svcKey = "c-metrics"
	const svcName = "checkout-api"
	if err := database.NewAgentRepository().UpsertServices(agent.ID, time.Now(), []models.AgentService{{
		AgentID: agent.ID, Key: svcKey, Name: svcName, CheckType: "http", Endpoint: "http://x",
	}}); err != nil {
		t.Fatalf("seed agent service: %v", err)
	}

	stamp := uint64(time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC).UnixNano())
	metricsReq := &collectormetricspb.ExportMetricsServiceRequest{
		ResourceMetrics: []*metricspb.ResourceMetrics{{
			Resource: &resourcepb.Resource{Attributes: []*commonpb.KeyValue{
				{Key: "service.name", Value: stringValue(svcName)},
			}},
			ScopeMetrics: []*metricspb.ScopeMetrics{{
				Metrics: []*metricspb.Metric{
					{
						Name: "jvm.memory.used",
						Unit: "By",
						Data: &metricspb.Metric_Gauge{Gauge: &metricspb.Gauge{
							DataPoints: []*metricspb.NumberDataPoint{{
								TimeUnixNano: stamp,
								Value:        &metricspb.NumberDataPoint_AsInt{AsInt: 1048576},
							}},
						}},
					},
					{
						Name: "http.server.request.duration",
						Unit: "s",
						Data: &metricspb.Metric_Histogram{Histogram: &metricspb.Histogram{
							DataPoints: []*metricspb.HistogramDataPoint{{
								TimeUnixNano: stamp,
								Count:        4,
								Sum:          floatPtr(2.0),
								Attributes: []*commonpb.KeyValue{
									{Key: "http.route", Value: stringValue("/orders")},
								},
							}},
						}},
					},
				},
			}},
		}},
	}
	postOTLP(t, ts, "/api/v1/otlp/v1/metrics", agent.APIKey, metricsReq)

	// Metric names listed for the picker.
	_, namesRes := ts.doRequest(t, "GET",
		"/api/v1/agents/"+agent.ID+"/services/"+svcKey+"/otel-metrics", nil, auth...)
	if !namesRes.Success {
		t.Fatalf("list metric names failed: %v", namesRes.Error)
	}
	var names []models.OtelMetricName
	if err := json.Unmarshal(namesRes.Data, &names); err != nil {
		t.Fatalf("decode names: %v", err)
	}
	if len(names) != 2 {
		t.Fatalf("want 2 metric names, got %d: %+v", len(names), names)
	}

	// Gauge points read back with the int value coerced to float.
	_, pointsRes := ts.doRequest(t, "GET",
		"/api/v1/agents/"+agent.ID+"/services/"+svcKey+"/otel-metrics/points?name=jvm.memory.used", nil, auth...)
	if !pointsRes.Success {
		t.Fatalf("list points failed: %v", pointsRes.Error)
	}
	var points []models.OtelMetric
	if err := json.Unmarshal(pointsRes.Data, &points); err != nil {
		t.Fatalf("decode points: %v", err)
	}
	if len(points) != 1 || points[0].Value != 1048576 || points[0].MetricType != "gauge" {
		t.Fatalf("unexpected gauge points: %+v", points)
	}
	if points[0].AgentID != agent.ID || points[0].ServiceName != svcName {
		t.Fatalf("point not scoped to agent service: %+v", points[0])
	}

	// Histogram points carry count/total and value=avg.
	_, histRes := ts.doRequest(t, "GET",
		"/api/v1/agents/"+agent.ID+"/services/"+svcKey+"/otel-metrics/points?name=http.server.request.duration", nil, auth...)
	var histPoints []models.OtelMetric
	if err := json.Unmarshal(histRes.Data, &histPoints); err != nil {
		t.Fatalf("decode histogram points: %v", err)
	}
	if len(histPoints) != 1 || histPoints[0].Count != 4 || histPoints[0].Total != 2.0 || histPoints[0].Value != 0.5 {
		t.Fatalf("unexpected histogram points: %+v", histPoints)
	}

	// Missing name parameter is rejected.
	resp, _ := ts.doRequest(t, "GET",
		"/api/v1/agents/"+agent.ID+"/services/"+svcKey+"/otel-metrics/points", nil, auth...)
	if resp.StatusCode != 400 {
		t.Fatalf("points without name = %d, want 400", resp.StatusCode)
	}
}

func floatPtr(f float64) *float64 { return &f }
