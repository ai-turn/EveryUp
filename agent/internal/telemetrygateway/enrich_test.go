package telemetrygateway

import (
	"testing"

	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	"google.golang.org/protobuf/proto"
)

func traceBody(t *testing.T, serviceName string) []byte {
	t.Helper()
	rs := &tracepb.ResourceSpans{Resource: &resourcepb.Resource{}}
	if serviceName != "" {
		rs.Resource.Attributes = []*commonpb.KeyValue{{Key: "service.name", Value: stringAttr(serviceName)}}
	}
	body, err := proto.Marshal(&collectortracepb.ExportTraceServiceRequest{ResourceSpans: []*tracepb.ResourceSpans{rs}})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return body
}

func resolvedName(t *testing.T, body []byte) (string, bool) {
	t.Helper()
	var req collectortracepb.ExportTraceServiceRequest
	if err := proto.Unmarshal(body, &req); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	for _, attr := range req.GetResourceSpans()[0].GetResource().GetAttributes() {
		if attr.GetKey() == "service.name" {
			return attr.GetValue().GetStringValue(), true
		}
	}
	return "", false
}

func TestInjectServiceName(t *testing.T) {
	cases := []struct {
		name       string
		existing   string
		want       string
		wantChange bool
	}{
		{"absent -> injected", "", "my-api", true},
		{"unknown_service default -> overridden", "unknown_service:node", "my-api", true},
		{"explicit -> respected", "billing", "billing", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			out, changed := injectServiceName("traces", traceBody(t, tc.existing), "my-api")
			if changed != tc.wantChange {
				t.Fatalf("changed = %v, want %v", changed, tc.wantChange)
			}
			got, ok := resolvedName(t, out)
			if !ok || got != tc.want {
				t.Fatalf("service.name = %q (found=%v), want %q", got, ok, tc.want)
			}
		})
	}
}

func TestInjectServiceNameIgnoresGarbage(t *testing.T) {
	body := []byte{1, 2, 3}
	out, changed := injectServiceName("traces", body, "my-api")
	if changed || string(out) != string(body) {
		t.Fatalf("garbage payload should pass through untouched")
	}
}
