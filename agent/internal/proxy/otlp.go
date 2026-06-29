package proxy

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	"google.golang.org/protobuf/proto"
)

type traceContext struct {
	TraceID      []byte
	SpanID       []byte
	ParentSpanID []byte
	Flags        string
}

type spanPayload struct {
	Trace       traceContext
	ServiceName string
	Method      string
	Path        string
	Route       string
	StatusCode  int
	Duration    time.Duration
	Start       time.Time
	End         time.Time
	ClientIP    string
	ReqBody     bodySnapshot
	RespBody    bodySnapshot
	BodyKept    bool
}

type otlpExporter struct {
	endpoint string
	client   *http.Client
}

func newOTLPExporter(endpoint string, timeout time.Duration) *otlpExporter {
	endpoint = strings.TrimRight(strings.TrimSpace(endpoint), "/")
	if endpoint == "" {
		return nil
	}
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	return &otlpExporter{endpoint: endpoint, client: &http.Client{Timeout: timeout}}
}

func (e *otlpExporter) enabled() bool {
	return e != nil && e.endpoint != ""
}

func (e *otlpExporter) exportSpan(ctx context.Context, payload spanPayload) error {
	if !e.enabled() {
		return nil
	}
	attrs := []*commonpb.KeyValue{
		stringKV("http.request.method", strings.ToUpper(payload.Method)),
		stringKV("url.path", payload.Path),
		intKV("http.response.status_code", int64(payload.StatusCode)),
		intKV("http.server.duration_ms", payload.Duration.Milliseconds()),
		stringKV("everyup.source", "proxy"),
		boolKV("body_captured", payload.BodyKept),
		boolKV("request_body_truncated", payload.ReqBody.Truncated),
		boolKV("response_body_truncated", payload.RespBody.Truncated),
		intKV("request_body_size", int64(payload.ReqBody.Size)),
		intKV("response_body_size", int64(payload.RespBody.Size)),
	}
	if payload.Route != "" {
		attrs = append(attrs, stringKV("http.route", payload.Route))
	}
	if payload.ClientIP != "" {
		attrs = append(attrs, stringKV("client.address", payload.ClientIP))
	}

	events := make([]*tracepb.Span_Event, 0, 2)
	if payload.BodyKept && payload.ReqBody.Captured {
		events = append(events, bodyEvent("request_body_masked", payload.Start, payload.ReqBody))
	}
	if payload.BodyKept && payload.RespBody.Captured {
		events = append(events, bodyEvent("response_body_masked", payload.End, payload.RespBody))
	}

	status := &tracepb.Status{}
	if payload.StatusCode >= 500 {
		status.Code = tracepb.Status_STATUS_CODE_ERROR
	}
	span := &tracepb.Span{
		TraceId:           payload.Trace.TraceID,
		SpanId:            payload.Trace.SpanID,
		ParentSpanId:      payload.Trace.ParentSpanID,
		Name:              strings.ToUpper(payload.Method) + " " + payload.Path,
		Kind:              tracepb.Span_SPAN_KIND_SERVER,
		StartTimeUnixNano: uint64(payload.Start.UnixNano()),
		EndTimeUnixNano:   uint64(payload.End.UnixNano()),
		Attributes:        attrs,
		Events:            events,
		Status:            status,
	}
	req := &collectortracepb.ExportTraceServiceRequest{
		ResourceSpans: []*tracepb.ResourceSpans{{
			Resource: &resourcepb.Resource{Attributes: []*commonpb.KeyValue{
				stringKV("service.name", payload.ServiceName),
			}},
			ScopeSpans: []*tracepb.ScopeSpans{{Spans: []*tracepb.Span{span}}},
		}},
	}
	data, err := proto.Marshal(req)
	if err != nil {
		return fmt.Errorf("encode proxy span: %w", err)
	}
	return e.post(ctx, "/v1/traces", data)
}

func (e *otlpExporter) post(ctx context.Context, path string, data []byte) error {
	endpoint := e.endpoint + path
	if parsed, err := url.Parse(e.endpoint); err == nil && strings.HasSuffix(parsed.Path, path) {
		endpoint = e.endpoint
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-protobuf")
	resp, err := e.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("otlp endpoint returned %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

func bodyEvent(name string, at time.Time, body bodySnapshot) *tracepb.Span_Event {
	return &tracepb.Span_Event{
		Name:         name,
		TimeUnixNano: uint64(at.UnixNano()),
		Attributes: []*commonpb.KeyValue{
			stringKV("body", body.Body),
			intKV("body_size", int64(body.Size)),
			boolKV("body_truncated", body.Truncated),
			boolKV("mask_applied", true),
		},
	}
}

func traceContextFromHeader(header string) traceContext {
	traceID, parentID, flags, ok := parseTraceparent(header)
	if !ok {
		traceID = randomBytes(16)
		flags = "01"
	}
	return traceContext{
		TraceID:      traceID,
		ParentSpanID: parentID,
		SpanID:       randomBytes(8),
		Flags:        flags,
	}
}

func (tc traceContext) header() string {
	flags := tc.Flags
	if flags == "" {
		flags = "01"
	}
	return "00-" + hex.EncodeToString(tc.TraceID) + "-" + hex.EncodeToString(tc.SpanID) + "-" + flags
}

func parseTraceparent(value string) ([]byte, []byte, string, bool) {
	parts := strings.Split(strings.TrimSpace(value), "-")
	if len(parts) != 4 || parts[0] != "00" || len(parts[1]) != 32 || len(parts[2]) != 16 || len(parts[3]) != 2 {
		return nil, nil, "", false
	}
	traceID, err := hex.DecodeString(parts[1])
	if err != nil || allZero(traceID) {
		return nil, nil, "", false
	}
	spanID, err := hex.DecodeString(parts[2])
	if err != nil || allZero(spanID) {
		return nil, nil, "", false
	}
	return traceID, spanID, strings.ToLower(parts[3]), true
}

func randomBytes(length int) []byte {
	out := make([]byte, length)
	if _, err := rand.Read(out); err != nil || allZero(out) {
		fallback := time.Now().UnixNano()
		for i := range out {
			out[i] = byte(fallback >> (uint(i%8) * 8))
		}
	}
	return out
}

func allZero(value []byte) bool {
	for _, b := range value {
		if b != 0 {
			return false
		}
	}
	return len(value) > 0
}

func stringKV(key, value string) *commonpb.KeyValue {
	return &commonpb.KeyValue{Key: key, Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: value}}}
}

func intKV(key string, value int64) *commonpb.KeyValue {
	return &commonpb.KeyValue{Key: key, Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_IntValue{IntValue: value}}}
}

func boolKV(key string, value bool) *commonpb.KeyValue {
	return &commonpb.KeyValue{Key: key, Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_BoolValue{BoolValue: value}}}
}

func exportAsync(exporter *otlpExporter, payload spanPayload) {
	if exporter == nil || !exporter.enabled() {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := exporter.exportSpan(ctx, payload); err != nil {
			log.Printf("proxy OTLP export failed: %v", err)
		}
	}()
}
