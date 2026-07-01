package telemetrygateway

import (
	"strings"

	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	"google.golang.org/protobuf/proto"
)

// injectServiceName sets service.name on every resource in an OTLP payload when
// the app did not set a meaningful one — empty, or the OTel SDK "unknown_service"
// default. An explicit service.name is left untouched, so OTEL_SERVICE_NAME still
// wins when the app provides it. Returns the re-encoded payload and whether it
// changed; on any decode/encode error the original bytes are forwarded as-is.
func injectServiceName(signal string, body []byte, name string) ([]byte, bool) {
	switch signal {
	case "traces":
		var req collectortracepb.ExportTraceServiceRequest
		if err := proto.Unmarshal(body, &req); err != nil {
			return body, false
		}
		changed := false
		for _, rs := range req.GetResourceSpans() {
			if rs.Resource == nil {
				rs.Resource = &resourcepb.Resource{}
			}
			if setServiceName(rs.Resource, name) {
				changed = true
			}
		}
		return remarshal(&req, body, changed)
	case "logs":
		var req collectorlogspb.ExportLogsServiceRequest
		if err := proto.Unmarshal(body, &req); err != nil {
			return body, false
		}
		changed := false
		for _, rl := range req.GetResourceLogs() {
			if rl.Resource == nil {
				rl.Resource = &resourcepb.Resource{}
			}
			if setServiceName(rl.Resource, name) {
				changed = true
			}
		}
		return remarshal(&req, body, changed)
	}
	return body, false
}

func remarshal(msg proto.Message, orig []byte, changed bool) ([]byte, bool) {
	if !changed {
		return orig, false
	}
	out, err := proto.Marshal(msg)
	if err != nil {
		return orig, false
	}
	return out, true
}

// setServiceName sets the service.name resource attribute unless the app already
// set an explicit (non-"unknown_service") value. Returns whether it changed.
func setServiceName(res *resourcepb.Resource, name string) bool {
	for _, attr := range res.GetAttributes() {
		if attr.GetKey() != "service.name" {
			continue
		}
		existing := attr.GetValue().GetStringValue()
		if existing != "" && !strings.HasPrefix(existing, "unknown_service") {
			return false
		}
		attr.Value = stringAttr(name)
		return true
	}
	res.Attributes = append(res.Attributes, &commonpb.KeyValue{
		Key:   "service.name",
		Value: stringAttr(name),
	})
	return true
}

func stringAttr(s string) *commonpb.AnyValue {
	return &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: s}}
}
