package handlers

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	"google.golang.org/protobuf/proto"
)

// OTLPIngestHandler receives OpenTelemetry OTLP/HTTP protobuf payloads.
type OTLPIngestHandler struct {
	logHandler *LogIngestHandler
	spanRepo   *database.SpanRepository
	reqRepo    *database.ApiRequestRepository
}

// NewOTLPIngestHandler creates an OTLP ingest handler.
func NewOTLPIngestHandler() *OTLPIngestHandler {
	return &OTLPIngestHandler{
		logHandler: NewLogIngestHandler(),
		spanRepo:   database.NewSpanRepository(),
		reqRepo:    database.NewApiRequestRepository(),
	}
}

// IngestLogs handles POST /api/v1/otlp/v1/logs.
func (h *OTLPIngestHandler) IngestLogs(c *fiber.Ctx) error {
	service, ok := c.Locals("service").(*models.Service)
	if !ok || service == nil {
		return unauthorizedOTLP(c)
	}

	var req collectorlogspb.ExportLogsServiceRequest
	if err := proto.Unmarshal(c.Body(), &req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeInvalidRequest,
				"message": "Invalid OTLP logs protobuf payload: " + err.Error(),
			},
		})
	}

	processed := 0
	filtered := 0
	failed := 0

	for _, resourceLogs := range req.ResourceLogs {
		resourceMap := attrsToMap(resourceLogs.GetResource().GetAttributes())
		resourceJSON := mustJSON(resourceMap)
		serviceName := firstString(resourceMap, "service.name")
		if serviceName == "" {
			serviceName = service.Name
		}

		for _, scopeLogs := range resourceLogs.ScopeLogs {
			for _, record := range scopeLogs.LogRecords {
				entry, otel := logRecordToEntry(record, resourceMap)
				logEntry, err := h.logHandler.processEntry(service, &entry, models.LogSourceOTLP)
				if errors.Is(err, errLogFiltered) {
					filtered++
					continue
				}
				if err != nil {
					log.Printf("[OTLP] log validation failed for service %s: %v", service.ID, err)
					failed++
					continue
				}

				logEntry.ServiceName = serviceName
				logEntry.TraceID = otel.traceID
				logEntry.SpanID = otel.spanID
				logEntry.SeverityNumber = otel.severityNumber
				logEntry.ObservedAt = otel.observedAt
				logEntry.Resource = resourceJSON
				logEntry.Attributes = otel.attributes
				if otel.timestamp != nil {
					logEntry.CreatedAt = *otel.timestamp
				}

				if err := h.logHandler.logRepo.Create(logEntry); err != nil {
					log.Printf("[OTLP] failed to store log for service %s: %v", service.ID, err)
					failed++
					continue
				}
				h.logHandler.triggerAlertIfNeeded(service, logEntry, entry.Metadata)
				processed++
			}
		}
	}

	body, err := proto.Marshal(&collectorlogspb.ExportLogsServiceResponse{})
	if err != nil {
		return err
	}
	c.Set(fiber.HeaderContentType, "application/x-protobuf")
	c.Set("X-EveryUp-Processed", strconv.Itoa(processed))
	c.Set("X-EveryUp-Filtered", strconv.Itoa(filtered))
	c.Set("X-EveryUp-Failed", strconv.Itoa(failed))
	return c.Status(fiber.StatusOK).Send(body)
}

// IngestTraces handles POST /api/v1/otlp/v1/traces.
func (h *OTLPIngestHandler) IngestTraces(c *fiber.Ctx) error {
	service, ok := c.Locals("service").(*models.Service)
	if !ok || service == nil {
		return unauthorizedOTLP(c)
	}

	var req collectortracepb.ExportTraceServiceRequest
	if err := proto.Unmarshal(c.Body(), &req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeInvalidRequest,
				"message": "Invalid OTLP traces protobuf payload: " + err.Error(),
			},
		})
	}

	var spans []models.Span
	var requests []models.ApiRequest

	for _, resourceSpans := range req.ResourceSpans {
		resourceMap := attrsToMap(resourceSpans.GetResource().GetAttributes())
		resourceJSON := mustJSON(resourceMap)
		serviceName := firstString(resourceMap, "service.name")
		if serviceName == "" {
			serviceName = service.Name
		}

		for _, scopeSpans := range resourceSpans.ScopeSpans {
			for _, span := range scopeSpans.Spans {
				modelSpan := spanToModel(service, serviceName, resourceJSON, span)
				spans = append(spans, modelSpan)

				if req, ok := spanToAPIRequest(service, serviceName, span); ok {
					requests = append(requests, req)
				}
			}
		}
	}

	insertedSpans, err := h.spanRepo.CreateBatch(spans)
	if err != nil {
		log.Printf("[OTLP] failed to store spans for service %s: %v", service.ID, err)
		return internalError(c, ErrCodeDatabase, err)
	}

	insertedRequests, err := h.reqRepo.CreateBatch(requests)
	if err != nil {
		log.Printf("[OTLP] failed to store API request projections for service %s: %v", service.ID, err)
		return internalError(c, ErrCodeDatabase, err)
	}

	body, err := proto.Marshal(&collectortracepb.ExportTraceServiceResponse{})
	if err != nil {
		return err
	}
	c.Set(fiber.HeaderContentType, "application/x-protobuf")
	c.Set("X-EveryUp-Spans", strconv.Itoa(insertedSpans))
	c.Set("X-EveryUp-Api-Requests", strconv.Itoa(insertedRequests))
	return c.Status(fiber.StatusOK).Send(body)
}

type otelLogFields struct {
	traceID        string
	spanID         string
	severityNumber int
	timestamp      *time.Time
	observedAt     *time.Time
	attributes     json.RawMessage
}

func logRecordToEntry(record *logspb.LogRecord, resource map[string]interface{}) (models.LogIngestEntry, otelLogFields) {
	attrs := attrsToMap(record.GetAttributes())
	metadata := map[string]interface{}{
		"attributes": attrs,
		"resource":   resource,
	}

	severityNumber := int(record.GetSeverityNumber())
	level := severityNumberToLevel(severityNumber)
	message := anyValueToString(record.GetBody())
	if message == "" {
		message = record.GetSeverityText()
	}

	var timestamp *time.Time
	if record.GetTimeUnixNano() > 0 {
		t := timeFromUnixNano(record.GetTimeUnixNano())
		timestamp = &t
	}
	var observedAt *time.Time
	if record.GetObservedTimeUnixNano() > 0 {
		t := timeFromUnixNano(record.GetObservedTimeUnixNano())
		observedAt = &t
	}

	return models.LogIngestEntry{
			Level:    level,
			Message:  message,
			Metadata: metadata,
		}, otelLogFields{
			traceID:        bytesToHex(record.GetTraceId()),
			spanID:         bytesToHex(record.GetSpanId()),
			severityNumber: severityNumber,
			timestamp:      timestamp,
			observedAt:     observedAt,
			attributes:     mustJSON(attrs),
		}
}

func severityNumberToLevel(severityNumber int) models.LogLevel {
	switch {
	case severityNumber >= 17:
		return models.LogLevelError
	case severityNumber >= 13:
		return models.LogLevelWarn
	case severityNumber >= 9:
		return models.LogLevelInfo
	case severityNumber >= 5:
		return models.LogLevelDebug
	case severityNumber >= 1:
		return models.LogLevelTrace
	default:
		return models.LogLevelInfo
	}
}

func spanToModel(service *models.Service, serviceName string, resource json.RawMessage, span *tracepb.Span) models.Span {
	attrs := attrsToMap(span.GetAttributes())
	start := span.GetStartTimeUnixNano()
	end := span.GetEndTimeUnixNano()
	durationMs := 0
	if end > start {
		durationMs = int((end - start) / uint64(time.Millisecond))
	}

	return models.Span{
		ServiceID:     service.ID,
		ServiceName:   serviceName,
		TraceID:       bytesToHex(span.GetTraceId()),
		SpanID:        bytesToHex(span.GetSpanId()),
		ParentSpanID:  bytesToHex(span.GetParentSpanId()),
		Name:          span.GetName(),
		Kind:          spanKindString(span.GetKind()),
		StartUnixNano: start,
		EndUnixNano:   end,
		DurationMs:    durationMs,
		StatusCode:    spanStatusCodeString(span.GetStatus().GetCode()),
		StatusMessage: span.GetStatus().GetMessage(),
		Attributes:    mustJSON(attrs),
		Events:        mustJSON(spanEventsToSlice(span.GetEvents())),
		Links:         mustJSON(spanLinksToSlice(span.GetLinks())),
		Resource:      resource,
		CreatedAt:     time.Now(),
	}
}

func spanToAPIRequest(service *models.Service, serviceName string, span *tracepb.Span) (models.ApiRequest, bool) {
	if span.GetKind() != tracepb.Span_SPAN_KIND_SERVER {
		return models.ApiRequest{}, false
	}

	attrs := attrsToMap(span.GetAttributes())
	method := firstString(attrs, "http.request.method", "http.method")
	statusCode := firstInt(attrs, "http.response.status_code", "http.status_code")
	if method == "" || statusCode == 0 {
		return models.ApiRequest{}, false
	}

	path := firstString(attrs, "url.path", "http.target", "http.route")
	if path == "" {
		path = span.GetName()
	}
	route := firstString(attrs, "http.route")
	pathTemplate := route
	if pathTemplate == "" {
		pathTemplate = NormalizePath(path)
	}

	start := span.GetStartTimeUnixNano()
	end := span.GetEndTimeUnixNano()
	durationMs := 0
	if end > start {
		durationMs = int((end - start) / uint64(time.Millisecond))
	}

	errMsg := span.GetStatus().GetMessage()
	isError := statusCode >= 500 || span.GetStatus().GetCode() == tracepb.Status_STATUS_CODE_ERROR

	return models.ApiRequest{
		ServiceID:    service.ID,
		ServiceName:  serviceName,
		RequestID:    bytesToHex(span.GetSpanId()),
		TraceID:      bytesToHex(span.GetTraceId()),
		SpanID:       bytesToHex(span.GetSpanId()),
		Method:       strings.ToUpper(method),
		Path:         path,
		PathTemplate: pathTemplate,
		Route:        route,
		StatusCode:   statusCode,
		DurationMs:   durationMs,
		ClientIP:     firstString(attrs, "client.address", "net.peer.ip", "http.client_ip"),
		Error:        errMsg,
		IsError:      isError,
		CreatedAt:    timeFromUnixNano(start),
	}, true
}

func attrsToMap(attrs []*commonpb.KeyValue) map[string]interface{} {
	out := make(map[string]interface{}, len(attrs))
	for _, attr := range attrs {
		out[attr.GetKey()] = anyValueToInterface(attr.GetValue())
	}
	return out
}

func anyValueToInterface(v *commonpb.AnyValue) interface{} {
	switch val := v.GetValue().(type) {
	case *commonpb.AnyValue_StringValue:
		return val.StringValue
	case *commonpb.AnyValue_BoolValue:
		return val.BoolValue
	case *commonpb.AnyValue_IntValue:
		return val.IntValue
	case *commonpb.AnyValue_DoubleValue:
		return val.DoubleValue
	case *commonpb.AnyValue_BytesValue:
		return bytesToHex(val.BytesValue)
	case *commonpb.AnyValue_ArrayValue:
		items := val.ArrayValue.GetValues()
		out := make([]interface{}, 0, len(items))
		for _, item := range items {
			out = append(out, anyValueToInterface(item))
		}
		return out
	case *commonpb.AnyValue_KvlistValue:
		return attrsToMap(val.KvlistValue.GetValues())
	default:
		return nil
	}
}

func anyValueToString(v *commonpb.AnyValue) string {
	if v == nil {
		return ""
	}
	if s, ok := anyValueToInterface(v).(string); ok {
		return s
	}
	data, err := json.Marshal(anyValueToInterface(v))
	if err != nil {
		return fmt.Sprint(anyValueToInterface(v))
	}
	return string(data)
}

func spanEventsToSlice(events []*tracepb.Span_Event) []map[string]interface{} {
	out := make([]map[string]interface{}, 0, len(events))
	for _, event := range events {
		out = append(out, map[string]interface{}{
			"name":         event.GetName(),
			"timeUnixNano": event.GetTimeUnixNano(),
			"attributes":   attrsToMap(event.GetAttributes()),
		})
	}
	return out
}

func spanLinksToSlice(links []*tracepb.Span_Link) []map[string]interface{} {
	out := make([]map[string]interface{}, 0, len(links))
	for _, link := range links {
		out = append(out, map[string]interface{}{
			"traceId":    bytesToHex(link.GetTraceId()),
			"spanId":     bytesToHex(link.GetSpanId()),
			"traceState": link.GetTraceState(),
			"attributes": attrsToMap(link.GetAttributes()),
		})
	}
	return out
}

func firstString(m map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if v, ok := m[key]; ok {
			switch value := v.(type) {
			case string:
				return value
			case fmt.Stringer:
				return value.String()
			}
		}
	}
	return ""
}

func firstInt(m map[string]interface{}, keys ...string) int {
	for _, key := range keys {
		if v, ok := m[key]; ok {
			switch value := v.(type) {
			case int:
				return value
			case int64:
				return int(value)
			case float64:
				return int(value)
			case string:
				i, _ := strconv.Atoi(value)
				return i
			}
		}
	}
	return 0
}

func spanKindString(kind tracepb.Span_SpanKind) string {
	return strings.TrimPrefix(kind.String(), "SPAN_KIND_")
}

func spanStatusCodeString(code tracepb.Status_StatusCode) string {
	return strings.TrimPrefix(code.String(), "STATUS_CODE_")
}

func bytesToHex(b []byte) string {
	if len(b) == 0 {
		return ""
	}
	return hex.EncodeToString(b)
}

func timeFromUnixNano(nano uint64) time.Time {
	return time.Unix(0, int64(nano)).UTC()
}

func mustJSON(v interface{}) json.RawMessage {
	data, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	return data
}

func unauthorizedOTLP(c *fiber.Ctx) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
		"success": false,
		"error": fiber.Map{
			"code":    "UNAUTHORIZED",
			"message": "Service not found in context",
		},
	})
}

func _resourcePackageAnchor(_ *resourcepb.Resource) {}
