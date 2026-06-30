package webclient

import (
	"context"
	"crypto/rand"
	"fmt"
	"strings"
	"time"

	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	"google.golang.org/protobuf/proto"
)

// OTLPSpanBatch is a set of synthetic SERVER spans for one container, derived
// from parsed access-log lines. They feed the web's span->api_request projection
// (spanToAPIRequest), so a log-only service with no instrumentation and no proxy
// still populates the Requests view. Duration is unknown from logs, so spans are
// zero-width (duration_ms = 0).
type OTLPSpanBatch struct {
	ServiceName   string
	ContainerID   string
	ContainerName string
	Spans         []OTLPSpanEntry
}

// OTLPSpanEntry is one access-log line's worth of HTTP metadata.
type OTLPSpanEntry struct {
	Method     string
	Path       string
	StatusCode int
	Timestamp  time.Time
}

// SendOTLPSpans encodes the batches as OTLP SERVER spans and posts them to the
// web traces endpoint. The web side projects them into api_requests exactly like
// instrumented spans — the "spans are the one source of truth" invariant holds.
func (c *Client) SendOTLPSpans(ctx context.Context, batches []OTLPSpanBatch) error {
	if len(batches) == 0 {
		return nil
	}
	if !c.Enabled() {
		return fmt.Errorf("web client is not configured")
	}

	req := &collectortracepb.ExportTraceServiceRequest{}
	for _, batch := range batches {
		if batch.ServiceName == "" || len(batch.Spans) == 0 {
			continue
		}
		resourceAttrs := []*commonpb.KeyValue{{Key: "service.name", Value: stringValue(batch.ServiceName)}}
		if batch.ContainerID != "" {
			resourceAttrs = append(resourceAttrs, &commonpb.KeyValue{Key: "container.id", Value: stringValue(batch.ContainerID)})
		}
		if batch.ContainerName != "" {
			resourceAttrs = append(resourceAttrs, &commonpb.KeyValue{Key: "container.name", Value: stringValue(batch.ContainerName)})
		}

		spans := make([]*tracepb.Span, 0, len(batch.Spans))
		for _, entry := range batch.Spans {
			if entry.Method == "" || entry.StatusCode == 0 {
				continue
			}
			ts := entry.Timestamp
			if ts.IsZero() {
				ts = time.Now()
			}
			nano := uint64(ts.UnixNano())
			status := &tracepb.Status{}
			if entry.StatusCode >= 500 {
				status.Code = tracepb.Status_STATUS_CODE_ERROR
			}
			method := strings.ToUpper(entry.Method)
			spans = append(spans, &tracepb.Span{
				TraceId:           randomBytes(16),
				SpanId:            randomBytes(8),
				Name:              method + " " + entry.Path,
				Kind:              tracepb.Span_SPAN_KIND_SERVER,
				StartTimeUnixNano: nano,
				EndTimeUnixNano:   nano,
				Attributes: []*commonpb.KeyValue{
					{Key: "http.request.method", Value: stringValue(method)},
					{Key: "url.path", Value: stringValue(entry.Path)},
					{Key: "http.response.status_code", Value: intValue(int64(entry.StatusCode))},
					{Key: "everyup.source", Value: stringValue("access_log")},
				},
				Status: status,
			})
		}
		if len(spans) == 0 {
			continue
		}
		req.ResourceSpans = append(req.ResourceSpans, &tracepb.ResourceSpans{
			Resource:   &resourcepb.Resource{Attributes: resourceAttrs},
			ScopeSpans: []*tracepb.ScopeSpans{{Spans: spans}},
		})
	}
	if len(req.ResourceSpans) == 0 {
		return nil
	}

	data, err := proto.Marshal(req)
	if err != nil {
		return fmt.Errorf("encode OTLP spans: %w", err)
	}
	return c.SendOTLPProtobuf(ctx, "traces", data)
}

func intValue(v int64) *commonpb.AnyValue {
	return &commonpb.AnyValue{Value: &commonpb.AnyValue_IntValue{IntValue: v}}
}

// randomBytes returns n cryptographically random bytes for trace/span IDs. A
// rand failure is non-fatal here: the row keys on an autoincrement id, not these
// bytes, and the collector accepts zero IDs.
func randomBytes(n int) []byte {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return b
}
