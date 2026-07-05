package handlers

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
)

func TestSeverityNumberToLevel(t *testing.T) {
	tests := []struct {
		name   string
		number int
		want   models.LogLevel
	}{
		{name: "unset defaults to info", number: 0, want: models.LogLevelInfo},
		{name: "trace range", number: 4, want: models.LogLevelTrace},
		{name: "debug range", number: 8, want: models.LogLevelDebug},
		{name: "info range", number: 12, want: models.LogLevelInfo},
		{name: "warn range", number: 16, want: models.LogLevelWarn},
		{name: "error range", number: 24, want: models.LogLevelError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := severityNumberToLevel(tt.number); got != tt.want {
				t.Fatalf("severityNumberToLevel(%d) = %q, want %q", tt.number, got, tt.want)
			}
		})
	}
}

func TestReadOTLPBodySupportsGzip(t *testing.T) {
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	if _, err := gz.Write([]byte("payload")); err != nil {
		t.Fatalf("gzip write: %v", err)
	}
	if err := gz.Close(); err != nil {
		t.Fatalf("gzip close: %v", err)
	}

	app := fiber.New()
	app.Post("/", func(c *fiber.Ctx) error {
		body, err := readOTLPBody(c)
		if err != nil {
			return err
		}
		return c.Send(body)
	})

	req := httptest.NewRequest("POST", "/", bytes.NewReader(buf.Bytes()))
	req.Header.Set("Content-Encoding", "gzip")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()

	got, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	if string(got) != "payload" {
		t.Fatalf("decoded body = %q, want payload", got)
	}
}

func TestDecodeGzipOTLPRejectsOversized(t *testing.T) {
	// Build a payload that compresses small but expands past the 16 MiB cap.
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	chunk := bytes.Repeat([]byte{'A'}, 1<<20) // 1 MiB
	for i := 0; i < 17; i++ {                 // 17 MiB total > 16 MiB cap
		if _, err := gz.Write(chunk); err != nil {
			t.Fatalf("gzip write: %v", err)
		}
	}
	if err := gz.Close(); err != nil {
		t.Fatalf("gzip close: %v", err)
	}

	if _, err := decodeGzipOTLP(buf.Bytes()); err == nil {
		t.Fatal("expected oversized gzip payload to be rejected, got nil error")
	} else if !bytes.Contains([]byte(err.Error()), []byte("exceeds")) {
		t.Fatalf("error = %v, want to contain 'exceeds'", err)
	}
}

func TestDecodeGzipOTLPAcceptsAtLimit(t *testing.T) {
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	chunk := bytes.Repeat([]byte{'A'}, 1<<20) // 1 MiB
	for i := 0; i < 16; i++ {                 // exactly 16 MiB
		if _, err := gz.Write(chunk); err != nil {
			t.Fatalf("gzip write: %v", err)
		}
	}
	if err := gz.Close(); err != nil {
		t.Fatalf("gzip close: %v", err)
	}

	decoded, err := decodeGzipOTLP(buf.Bytes())
	if err != nil {
		t.Fatalf("at-limit payload should be accepted, got: %v", err)
	}
	if len(decoded) != 16<<20 {
		t.Fatalf("decoded length = %d, want %d", len(decoded), 16<<20)
	}
}

func TestLogRecordToEntryPreservesOTelFields(t *testing.T) {
	ts := uint64(time.Date(2026, 5, 8, 12, 0, 0, 0, time.UTC).UnixNano())
	record := &logspb.LogRecord{
		TimeUnixNano:         ts,
		ObservedTimeUnixNano: ts + uint64(time.Second),
		SeverityNumber:       logspb.SeverityNumber_SEVERITY_NUMBER_ERROR,
		Body:                 stringValue("database failed"),
		TraceId:              []byte{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15},
		SpanId:               []byte{16, 17, 18, 19, 20, 21, 22, 23},
		Attributes: []*commonpb.KeyValue{
			{Key: "exception.type", Value: stringValue("timeout")},
		},
	}

	entry, otel := logRecordToEntry(record, map[string]interface{}{"service.name": "checkout"})
	if entry.Level != models.LogLevelError {
		t.Fatalf("entry.Level = %q, want error", entry.Level)
	}
	if entry.Message != "database failed" {
		t.Fatalf("entry.Message = %q, want database failed", entry.Message)
	}
	if otel.traceID != "000102030405060708090a0b0c0d0e0f" {
		t.Fatalf("traceID = %q", otel.traceID)
	}
	if otel.spanID != "1011121314151617" {
		t.Fatalf("spanID = %q", otel.spanID)
	}
	if otel.severityNumber != int(logspb.SeverityNumber_SEVERITY_NUMBER_ERROR) {
		t.Fatalf("severityNumber = %d", otel.severityNumber)
	}
	if otel.timestamp == nil || otel.observedAt == nil {
		t.Fatal("timestamp and observedAt should be populated")
	}
}

func TestSpanToAPIRequestOnlyProjectsHTTPServerSpans(t *testing.T) {
	service := &models.Service{ID: "svc-1", Name: "Checkout"}
	start := uint64(time.Date(2026, 5, 8, 12, 0, 0, 0, time.UTC).UnixNano())
	serverSpan := &tracepb.Span{
		TraceId:           []byte{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15},
		SpanId:            []byte{16, 17, 18, 19, 20, 21, 22, 23},
		Name:              "POST /orders/{id}",
		Kind:              tracepb.Span_SPAN_KIND_SERVER,
		StartTimeUnixNano: start,
		EndTimeUnixNano:   start + uint64(45*time.Millisecond),
		Attributes: []*commonpb.KeyValue{
			{Key: "http.request.method", Value: stringValue("post")},
			{Key: "http.route", Value: stringValue("/orders/{id}")},
			{Key: "url.path", Value: stringValue("/orders/42")},
			{Key: "http.response.status_code", Value: intValue(201)},
			{Key: "client.address", Value: stringValue("127.0.0.1")},
		},
	}

	req, ok := spanToAPIRequest(service.ID, "", "checkout-api", service.ApiExcludePaths, serverSpan)
	if !ok {
		t.Fatal("expected HTTP SERVER span to project to api_requests")
	}
	if req.Method != "POST" || req.Path != "/orders/42" || req.PathTemplate != "/orders/{id}" {
		t.Fatalf("unexpected request projection: %+v", req)
	}
	if req.StatusCode != 201 || req.DurationMs != 45 {
		t.Fatalf("unexpected status/duration: %+v", req)
	}
	if req.TraceID == "" || req.SpanID == "" {
		t.Fatalf("trace/span correlation missing: %+v", req)
	}

	clientSpan := *serverSpan
	clientSpan.Kind = tracepb.Span_SPAN_KIND_CLIENT
	if _, ok := spanToAPIRequest(service.ID, "", "checkout-api", service.ApiExcludePaths, &clientSpan); ok {
		t.Fatal("client span should not project to api_requests")
	}
}

func TestPathExcluded(t *testing.T) {
	cases := []struct {
		name  string
		path  string
		rules []string
		want  bool
	}{
		{name: "empty rules", path: "/users", rules: nil, want: false},
		{name: "exact match", path: "/health", rules: []string{"/health"}, want: true},
		{name: "exact no match", path: "/healthz", rules: []string{"/health"}, want: false},
		{name: "prefix wildcard match", path: "/actuator/health", rules: []string{"/actuator/*"}, want: true},
		{name: "prefix wildcard no match", path: "/users/me", rules: []string{"/actuator/*"}, want: false},
		{name: "root exact", path: "/", rules: []string{"/"}, want: true},
		{name: "root does not match prefix", path: "/users", rules: []string{"/"}, want: false},
		{name: "multiple rules first wins", path: "/actuator/info", rules: []string{"/health", "/actuator/*"}, want: true},
		{name: "empty path", path: "", rules: []string{"/health"}, want: false},
		{name: "skips empty rules", path: "/health", rules: []string{"", "/health"}, want: true},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			if got := pathExcluded(tt.path, tt.rules); got != tt.want {
				t.Fatalf("pathExcluded(%q, %v) = %v, want %v", tt.path, tt.rules, got, tt.want)
			}
		})
	}
}

func TestSpanToAPIRequestRespectsExcludePaths(t *testing.T) {
	service := &models.Service{
		ID:              "svc-1",
		Name:            "Checkout",
		ApiExcludePaths: []string{"/", "/actuator/*"},
	}
	start := uint64(time.Date(2026, 5, 8, 12, 0, 0, 0, time.UTC).UnixNano())
	build := func(path string) *tracepb.Span {
		return &tracepb.Span{
			TraceId:           []byte{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15},
			SpanId:            []byte{16, 17, 18, 19, 20, 21, 22, 23},
			Name:              "GET " + path,
			Kind:              tracepb.Span_SPAN_KIND_SERVER,
			StartTimeUnixNano: start,
			EndTimeUnixNano:   start + uint64(5*time.Millisecond),
			Attributes: []*commonpb.KeyValue{
				{Key: "http.request.method", Value: stringValue("GET")},
				{Key: "url.path", Value: stringValue(path)},
				{Key: "http.response.status_code", Value: intValue(403)},
			},
		}
	}

	if _, ok := spanToAPIRequest(service.ID, "", "checkout-api", service.ApiExcludePaths, build("/")); ok {
		t.Fatal("root path should be excluded")
	}
	if _, ok := spanToAPIRequest(service.ID, "", "checkout-api", service.ApiExcludePaths, build("/actuator/health")); ok {
		t.Fatal("actuator path should be excluded")
	}
	if _, ok := spanToAPIRequest(service.ID, "", "checkout-api", service.ApiExcludePaths, build("/orders/42")); !ok {
		t.Fatal("non-excluded path should still project")
	}
}

func TestAttrsToMapMasksSensitiveHeaders(t *testing.T) {
	attrs := []*commonpb.KeyValue{
		{Key: "http.request.header.authorization", Value: stringValue("Bearer secret-token")},
		{Key: "http.request.header.X-Api-Key", Value: stringValue("abc-123")},
		{Key: "http.request.header.cookie", Value: stringValue("session=xyz")},
		{Key: "http.response.header.Set-Cookie", Value: stringValue("auth=abcdef")},
		{Key: "http.request.header.content-type", Value: stringValue("application/json")},
		{Key: "http.request.body", Value: stringValue(`{"password":"hunter2"}`)},
		{Key: "http.route", Value: stringValue("/orders/{id}")},
	}

	out := attrsToMap(attrs)

	cases := map[string]string{
		"http.request.header.authorization": otelMaskedValue,
		"http.request.header.X-Api-Key":     otelMaskedValue,
		"http.request.header.cookie":        otelMaskedValue,
		"http.response.header.Set-Cookie":   otelMaskedValue,
		"http.request.body":                 otelMaskedValue,
		"http.request.header.content-type":  "application/json",
		"http.route":                        "/orders/{id}",
	}
	for key, want := range cases {
		got, ok := out[key]
		if !ok {
			t.Errorf("attribute %q missing from masked output", key)
			continue
		}
		if got != want {
			t.Errorf("attribute %q = %v, want %q", key, got, want)
		}
	}
}

func stringValue(value string) *commonpb.AnyValue {
	return &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: value}}
}

func intValue(value int64) *commonpb.AnyValue {
	return &commonpb.AnyValue{Value: &commonpb.AnyValue_IntValue{IntValue: value}}
}

func TestSpanEventsToSliceCapsBodySize(t *testing.T) {
	huge := strings.Repeat("x", maxStoredBodyBytes+100)
	events := []*tracepb.Span_Event{
		{
			Name: "request_body_masked",
			Attributes: []*commonpb.KeyValue{
				{Key: "body", Value: stringValue(huge)},
			},
		},
		{
			Name: "some_other_event",
			Attributes: []*commonpb.KeyValue{
				{Key: "body", Value: stringValue(huge)},
			},
		},
	}
	out := spanEventsToSlice(events)

	capped := out[0]["attributes"].(map[string]interface{})
	if body := capped["body"].(string); len(body) != maxStoredBodyBytes {
		t.Fatalf("captured body len = %d, want %d", len(body), maxStoredBodyBytes)
	}
	if capped["body_truncated"] != true {
		t.Fatal("capped body must be flagged truncated")
	}
	// Non-contract events keep their attributes untouched.
	other := out[1]["attributes"].(map[string]interface{})
	if body := other["body"].(string); len(body) != len(huge) {
		t.Fatalf("unrelated event body len = %d, want %d", len(body), len(huge))
	}
}
