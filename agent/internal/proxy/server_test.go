package proxy

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	"google.golang.org/protobuf/proto"
)

func TestReverseProxyForwardsRequest(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("method = %s", r.Method)
		}
		if r.URL.Path != "/api/orders" {
			t.Fatalf("path = %s", r.URL.Path)
		}
		if r.Header.Get("X-Forwarded-Proto") == "" {
			t.Fatal("missing X-Forwarded-Proto")
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}
		w.Header().Set("X-Upstream", "ok")
		_, _ = w.Write([]byte("upstream:" + string(body)))
	}))
	defer upstream.Close()

	srv, err := New(Config{ListenAddr: ":0", UpstreamURL: upstream.URL})
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/orders", io.NopCloser(io.LimitReader(&repeatReader{value: []byte("payload")}, 7)))
	req.Host = "example.test"

	srv.reverseProxy().ServeHTTP(recorder, req)

	resp := recorder.Result()
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	if resp.Header.Get("X-Upstream") != "ok" {
		t.Fatalf("X-Upstream = %q", resp.Header.Get("X-Upstream"))
	}
	body, _ := io.ReadAll(resp.Body)
	if string(body) != "upstream:payload" {
		t.Fatalf("body = %q", string(body))
	}
}

func TestProxyCapturesMaskedBodyAsSpanEvents(t *testing.T) {
	spans := make(chan *tracepb.Span, 1)
	otlp := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/traces" {
			t.Fatalf("unexpected OTLP path: %s", r.URL.Path)
		}
		data, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read otlp body: %v", err)
		}
		var req collectortracepb.ExportTraceServiceRequest
		if err := proto.Unmarshal(data, &req); err != nil {
			t.Fatalf("unmarshal traces: %v", err)
		}
		span := req.ResourceSpans[0].ScopeSpans[0].Spans[0]
		spans <- span
		w.Header().Set("Content-Type", "application/x-protobuf")
		w.WriteHeader(http.StatusOK)
	}))
	defer otlp.Close()

	upstreamSawTraceparent := ""
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamSawTraceparent = r.Header.Get("traceparent")
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read upstream body: %v", err)
		}
		if string(body) != `{"password":"hunter2","memo":"call me at 010-1234-5678"}` {
			t.Fatalf("upstream body changed: %s", string(body))
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"token":"secret-token","email":"me@example.com"}`))
	}))
	defer upstream.Close()

	srv, err := New(Config{
		ListenAddr:   ":0",
		UpstreamURL:  upstream.URL,
		ServiceName:  "checkout-api",
		OTLPEndpoint: otlp.URL,
		HTTPTimeout:  time.Second,
		CaptureConfig: CaptureConfig{
			Enabled:      true,
			Routes:       []string{"/api/..."},
			MaxBodyBytes: 256,
			OnStatus:     "500-599",
			OnSlow:       time.Hour,
		},
	})
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}
	handler := srv.captureMiddleware(srv.reverseProxy())

	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewBufferString(`{"password":"hunter2","memo":"call me at 010-1234-5678"}`))
	req.Header.Set("Content-Type", "application/json")
	handler.ServeHTTP(recorder, req)

	resp := recorder.Result()
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusInternalServerError {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	if string(body) != `{"token":"secret-token","email":"me@example.com"}` {
		t.Fatalf("response body changed: %s", string(body))
	}
	if upstreamSawTraceparent == "" {
		t.Fatal("proxy did not inject traceparent")
	}

	select {
	case span := <-spans:
		attrs := attrsToStrings(span.GetAttributes())
		if attrs["everyup.source"] != "proxy" || attrs["http.request.method"] != "POST" {
			t.Fatalf("unexpected attrs: %#v", attrs)
		}
		if len(span.GetEvents()) != 2 {
			t.Fatalf("events = %d, want 2", len(span.GetEvents()))
		}
		combined := eventsBody(span.GetEvents())
		if strings.Contains(combined, "hunter2") || strings.Contains(combined, "010-1234-5678") || strings.Contains(combined, "secret-token") || strings.Contains(combined, "me@example.com") {
			t.Fatalf("body was not masked: %s", combined)
		}
		if !strings.Contains(combined, "***") {
			t.Fatalf("masked body missing marker: %s", combined)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for OTLP span")
	}
}

func attrsToStrings(attrs []*commonpb.KeyValue) map[string]string {
	out := map[string]string{}
	for _, attr := range attrs {
		out[attr.GetKey()] = attr.GetValue().GetStringValue()
	}
	return out
}

func eventsBody(events []*tracepb.Span_Event) string {
	var out strings.Builder
	for _, event := range events {
		for _, attr := range event.GetAttributes() {
			if attr.GetKey() == "body" {
				out.WriteString(attr.GetValue().GetStringValue())
			}
		}
	}
	return out.String()
}

type repeatReader struct {
	value []byte
	read  bool
}

func (r *repeatReader) Read(p []byte) (int, error) {
	if r.read {
		return 0, io.EOF
	}
	r.read = true
	return copy(p, r.value), io.EOF
}
