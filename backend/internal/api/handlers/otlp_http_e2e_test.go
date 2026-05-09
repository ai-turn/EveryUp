package handlers_test

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	"google.golang.org/protobuf/proto"
)

func TestOTLPHTTPIngest_E2EStoresCorrelatedLogsSpansAndRequests(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")

	_, createResult := ts.doRequest(t, "POST", "/api/v1/services", map[string]interface{}{
		"id":   "otel-e2e",
		"name": "OTel E2E",
		"type": "log",
	}, authHeader(token)...)
	if !createResult.Success {
		t.Fatalf("service create failed: %+v", createResult.Error)
	}

	var service models.Service
	if err := json.Unmarshal(createResult.Data, &service); err != nil {
		t.Fatalf("decode created service: %v", err)
	}
	if service.ApiKey == "" {
		t.Fatal("created log service should return a plaintext API key")
	}

	traceID := []byte{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}
	spanID := []byte{16, 17, 18, 19, 20, 21, 22, 23}
	start := uint64(time.Date(2026, 5, 8, 12, 0, 0, 0, time.UTC).UnixNano())
	resourceAttrs := []*commonpb.KeyValue{
		{Key: "service.name", Value: stringValue("checkout-api")},
		{Key: "service.version", Value: stringValue("1.2.3")},
		{Key: "host.name", Value: stringValue("e2e-host")},
	}

	logReq := &collectorlogspb.ExportLogsServiceRequest{
		ResourceLogs: []*logspb.ResourceLogs{{
			Resource: &resourcepb.Resource{Attributes: resourceAttrs},
			ScopeLogs: []*logspb.ScopeLogs{{
				LogRecords: []*logspb.LogRecord{{
					TimeUnixNano:         start,
					ObservedTimeUnixNano: start + uint64(time.Millisecond),
					SeverityNumber:       logspb.SeverityNumber_SEVERITY_NUMBER_WARN,
					Body:                 stringValue("collector e2e warning"),
					TraceId:              traceID,
					SpanId:               spanID,
					Attributes: []*commonpb.KeyValue{
						{Key: "log.kind", Value: stringValue("e2e")},
					},
				}},
			}},
		}},
	}
	traceReq := &collectortracepb.ExportTraceServiceRequest{
		ResourceSpans: []*tracepb.ResourceSpans{{
			Resource: &resourcepb.Resource{Attributes: resourceAttrs},
			ScopeSpans: []*tracepb.ScopeSpans{{
				Spans: []*tracepb.Span{{
					TraceId:           traceID,
					SpanId:            spanID,
					Name:              "POST /orders/{id}",
					Kind:              tracepb.Span_SPAN_KIND_SERVER,
					StartTimeUnixNano: start,
					EndTimeUnixNano:   start + uint64(37*time.Millisecond),
					Status:            &tracepb.Status{Code: tracepb.Status_STATUS_CODE_OK},
					Attributes: []*commonpb.KeyValue{
						{Key: "http.request.method", Value: stringValue("POST")},
						{Key: "http.route", Value: stringValue("/orders/{id}")},
						{Key: "url.path", Value: stringValue("/orders/42")},
						{Key: "http.response.status_code", Value: intValue(201)},
						{Key: "client.address", Value: stringValue("127.0.0.1")},
					},
				}},
			}},
		}},
	}

	postOTLP(t, ts, "/api/v1/otlp/v1/logs", service.ApiKey, logReq)
	postOTLP(t, ts, "/api/v1/otlp/v1/traces", service.ApiKey, traceReq)

	const traceHex = "000102030405060708090a0b0c0d0e0f"
	const spanHex = "1011121314151617"

	var logTraceID, logSpanID, logLevel, logResource, logAttrs string
	var severityNumber int
	if err := database.DB.QueryRow(`
		SELECT trace_id, span_id, level, severity_number, resource, attributes
		FROM logs WHERE service_id = ? AND message = ?
	`, "otel-e2e", "collector e2e warning").Scan(
		&logTraceID, &logSpanID, &logLevel, &severityNumber, &logResource, &logAttrs,
	); err != nil {
		t.Fatalf("query OTLP log: %v", err)
	}
	if logTraceID != traceHex || logSpanID != spanHex || logLevel != "warn" || severityNumber != 13 {
		t.Fatalf("unexpected log correlation/severity: trace=%q span=%q level=%q severity=%d",
			logTraceID, logSpanID, logLevel, severityNumber)
	}
	if !strings.Contains(logResource, "checkout-api") || !strings.Contains(logAttrs, "log.kind") {
		t.Fatalf("resource/attributes were not preserved: resource=%s attrs=%s", logResource, logAttrs)
	}

	var storedSpanID, storedKind, storedResource string
	if err := database.DB.QueryRow(`
		SELECT span_id, kind, resource FROM spans WHERE trace_id = ?
	`, traceHex).Scan(&storedSpanID, &storedKind, &storedResource); err != nil {
		t.Fatalf("query span: %v", err)
	}
	if storedSpanID != spanHex || storedKind != "SERVER" || !strings.Contains(storedResource, "checkout-api") {
		t.Fatalf("unexpected stored span: span=%q kind=%q resource=%s", storedSpanID, storedKind, storedResource)
	}

	var reqTraceID, reqSpanID, method, path, route string
	var statusCode, durationMs int
	if err := database.DB.QueryRow(`
		SELECT trace_id, span_id, method, path, route, status_code, duration_ms
		FROM api_requests WHERE service_id = ?
	`, "otel-e2e").Scan(&reqTraceID, &reqSpanID, &method, &path, &route, &statusCode, &durationMs); err != nil {
		t.Fatalf("query API request projection: %v", err)
	}
	if reqTraceID != traceHex || reqSpanID != spanHex || method != "POST" ||
		path != "/orders/42" || route != "/orders/{id}" || statusCode != 201 || durationMs != 37 {
		t.Fatalf("unexpected api_request projection: trace=%q span=%q method=%q path=%q route=%q status=%d duration=%d",
			reqTraceID, reqSpanID, method, path, route, statusCode, durationMs)
	}
}

func TestTraces_GetByTraceIDReturnsCorrelatedSpansLogsAndApiRequests(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")

	_, createResult := ts.doRequest(t, "POST", "/api/v1/services", map[string]interface{}{
		"id":   "trace-corr",
		"name": "Trace correlation",
		"type": "log",
	}, authHeader(token)...)
	if !createResult.Success {
		t.Fatalf("service create failed: %+v", createResult.Error)
	}
	var service models.Service
	if err := json.Unmarshal(createResult.Data, &service); err != nil {
		t.Fatalf("decode service: %v", err)
	}

	traceID := []byte{0xca, 0xfe, 0xca, 0xfe, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c}
	spanID := []byte{0xab, 0xcd, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06}
	start := uint64(time.Date(2026, 5, 8, 12, 0, 0, 0, time.UTC).UnixNano())
	resourceAttrs := []*commonpb.KeyValue{
		{Key: "service.name", Value: stringValue("trace-corr-svc")},
	}

	logReq := &collectorlogspb.ExportLogsServiceRequest{
		ResourceLogs: []*logspb.ResourceLogs{{
			Resource: &resourcepb.Resource{Attributes: resourceAttrs},
			ScopeLogs: []*logspb.ScopeLogs{{
				LogRecords: []*logspb.LogRecord{{
					TimeUnixNano:   start,
					SeverityNumber: logspb.SeverityNumber_SEVERITY_NUMBER_INFO,
					Body:           stringValue("trace correlation log"),
					TraceId:        traceID,
					SpanId:         spanID,
				}},
			}},
		}},
	}
	traceReq := &collectortracepb.ExportTraceServiceRequest{
		ResourceSpans: []*tracepb.ResourceSpans{{
			Resource: &resourcepb.Resource{Attributes: resourceAttrs},
			ScopeSpans: []*tracepb.ScopeSpans{{
				Spans: []*tracepb.Span{{
					TraceId:           traceID,
					SpanId:            spanID,
					Name:              "GET /correlated",
					Kind:              tracepb.Span_SPAN_KIND_SERVER,
					StartTimeUnixNano: start,
					EndTimeUnixNano:   start + uint64(12*time.Millisecond),
					Status:            &tracepb.Status{Code: tracepb.Status_STATUS_CODE_OK},
					Attributes: []*commonpb.KeyValue{
						{Key: "http.request.method", Value: stringValue("GET")},
						{Key: "url.path", Value: stringValue("/correlated")},
						{Key: "http.response.status_code", Value: intValue(200)},
					},
				}},
			}},
		}},
	}

	postOTLP(t, ts, "/api/v1/otlp/v1/logs", service.ApiKey, logReq)
	postOTLP(t, ts, "/api/v1/otlp/v1/traces", service.ApiKey, traceReq)

	const traceHex = "cafecafe0102030405060708090a0b0c"
	resp, result := ts.doRequest(t, "GET", "/api/v1/traces/"+traceHex, nil, authHeader(token)...)
	if resp.StatusCode != 200 {
		t.Fatalf("GET /traces status=%d, error=%+v", resp.StatusCode, result.Error)
	}
	if !result.Success {
		t.Fatalf("response not successful: %+v", result.Error)
	}

	var data struct {
		TraceID     string                          `json:"traceId"`
		Spans       []struct{ SpanID, Kind string } `json:"spans"`
		Logs        []struct{ Message string }      `json:"logs"`
		ApiRequests []struct{ Method, Path string } `json:"apiRequests"`
	}
	if err := json.Unmarshal(result.Data, &data); err != nil {
		t.Fatalf("decode trace payload: %v", err)
	}

	if data.TraceID != traceHex {
		t.Fatalf("traceId = %q, want %q", data.TraceID, traceHex)
	}
	if len(data.Spans) != 1 || data.Spans[0].Kind != "SERVER" {
		t.Fatalf("spans = %+v, want one SERVER span", data.Spans)
	}
	if len(data.Logs) != 1 || data.Logs[0].Message != "trace correlation log" {
		t.Fatalf("logs = %+v, want correlation log", data.Logs)
	}
	if len(data.ApiRequests) != 1 || data.ApiRequests[0].Method != "GET" || data.ApiRequests[0].Path != "/correlated" {
		t.Fatalf("apiRequests = %+v, want GET /correlated", data.ApiRequests)
	}
}

func TestTraces_GetByUnknownTraceIDReturnsEmptyArrays(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")

	resp, result := ts.doRequest(t, "GET", "/api/v1/traces/0123456789abcdef0123456789abcdef", nil, authHeader(token)...)
	if resp.StatusCode != 200 {
		t.Fatalf("status=%d", resp.StatusCode)
	}
	var data struct {
		Spans       []json.RawMessage `json:"spans"`
		Logs        []json.RawMessage `json:"logs"`
		ApiRequests []json.RawMessage `json:"apiRequests"`
	}
	if err := json.Unmarshal(result.Data, &data); err != nil {
		t.Fatalf("decode: %v", err)
	}
	// Empty arrays, not null ??guarantees idiomatic frontend handling.
	if data.Spans == nil || data.Logs == nil || data.ApiRequests == nil {
		t.Fatalf("expected empty arrays, got: spans=%v logs=%v apiRequests=%v", data.Spans, data.Logs, data.ApiRequests)
	}
	if len(data.Spans) != 0 || len(data.Logs) != 0 || len(data.ApiRequests) != 0 {
		t.Fatalf("expected zero-length arrays, got %d/%d/%d", len(data.Spans), len(data.Logs), len(data.ApiRequests))
	}
}

func postOTLP(t *testing.T, ts *testServer, path, apiKey string, msg proto.Message) {
	t.Helper()

	payload, err := proto.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal OTLP payload: %v", err)
	}
	var gzipped bytes.Buffer
	gz := gzip.NewWriter(&gzipped)
	if _, err := gz.Write(payload); err != nil {
		t.Fatalf("gzip write: %v", err)
	}
	if err := gz.Close(); err != nil {
		t.Fatalf("gzip close: %v", err)
	}

	req := httptest.NewRequest("POST", path, bytes.NewReader(gzipped.Bytes()))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/x-protobuf")
	req.Header.Set("Content-Encoding", "gzip")

	resp, err := ts.App.Test(req, -1)
	if err != nil {
		t.Fatalf("POST %s: %v", path, err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		t.Fatalf("POST %s status=%d body=%s", path, resp.StatusCode, string(body))
	}
}

func stringValue(value string) *commonpb.AnyValue {
	return &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: value}}
}

func intValue(value int64) *commonpb.AnyValue {
	return &commonpb.AnyValue{Value: &commonpb.AnyValue_IntValue{IntValue: value}}
}
