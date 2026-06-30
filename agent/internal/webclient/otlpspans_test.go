package webclient

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	"google.golang.org/protobuf/proto"
)

func attrValue(attrs []*commonpb.KeyValue, key string) *commonpb.AnyValue {
	for _, a := range attrs {
		if a.GetKey() == key {
			return a.GetValue()
		}
	}
	return nil
}

// TestClientSendOTLPSpans locks the contract the web's spanToAPIRequest relies
// on: SERVER kind, a string http.request.method, and an INT http.response.status_code.
// If any of these drift, the Requests view silently stops projecting log-derived rows.
func TestClientSendOTLPSpans(t *testing.T) {
	var sawOTLP bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/otlp/v1/traces" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}
		var req collectortracepb.ExportTraceServiceRequest
		if err := proto.Unmarshal(body, &req); err != nil {
			t.Fatalf("unmarshal OTLP traces: %v", err)
		}
		if len(req.ResourceSpans) != 1 || len(req.ResourceSpans[0].ScopeSpans) != 1 {
			t.Fatalf("unexpected resource spans: %+v", req.ResourceSpans)
		}
		spans := req.ResourceSpans[0].ScopeSpans[0].Spans
		if len(spans) != 1 {
			t.Fatalf("expected 1 span, got %d", len(spans))
		}
		span := spans[0]
		if span.GetKind() != tracepb.Span_SPAN_KIND_SERVER {
			t.Fatalf("kind = %v, want SERVER", span.GetKind())
		}
		if v := attrValue(span.GetAttributes(), "http.request.method"); v.GetStringValue() != "GET" {
			t.Fatalf("http.request.method = %q", v.GetStringValue())
		}
		if v := attrValue(span.GetAttributes(), "http.response.status_code"); v.GetIntValue() != 500 {
			t.Fatalf("http.response.status_code = %v (int=%d)", v, v.GetIntValue())
		}
		if v := attrValue(span.GetAttributes(), "url.path"); v.GetStringValue() != "/api/x" {
			t.Fatalf("url.path = %q", v.GetStringValue())
		}
		if span.GetStatus().GetCode() != tracepb.Status_STATUS_CODE_ERROR {
			t.Fatalf("status 500 should map to ERROR, got %v", span.GetStatus().GetCode())
		}
		if len(span.GetSpanId()) != 8 || len(span.GetTraceId()) != 16 {
			t.Fatalf("span/trace id lengths = %d/%d", len(span.GetSpanId()), len(span.GetTraceId()))
		}
		sawOTLP = true
		w.Header().Set("Content-Type", "application/x-protobuf")
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := New(server.URL, "token", time.Second, server.Client())
	err := client.SendOTLPSpans(t.Context(), []OTLPSpanBatch{{
		ServiceName: "api",
		ContainerID: "container-1",
		Spans: []OTLPSpanEntry{{
			Method:     "get",
			Path:       "/api/x",
			StatusCode: 500,
			Timestamp:  time.Date(2026, 6, 26, 1, 2, 3, 0, time.UTC),
		}},
	}})
	if err != nil {
		t.Fatalf("SendOTLPSpans returned error: %v", err)
	}
	if !sawOTLP {
		t.Fatal("server did not receive OTLP spans")
	}
}
