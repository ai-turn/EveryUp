package webclient

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/aiturn/everyup/agent/internal/capabilities"
	"github.com/aiturn/everyup/agent/internal/state"
	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	"google.golang.org/protobuf/proto"
)

func TestClientEnrollAndSendEvents(t *testing.T) {
	var sawAuth bool
	var sawEvents bool
	var sawServices bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "Bearer token" {
			sawAuth = true
		}
		switch r.URL.Path {
		case "/api/v1/agents/enroll":
			_ = json.NewEncoder(w).Encode(EnrollmentResponse{AgentID: "agent-1"})
		case "/api/v1/agents/agent-1/events":
			sawEvents = true
			w.WriteHeader(http.StatusNoContent)
		case "/api/v1/agents/agent-1/services":
			var payload ServiceSnapshotRequest
			if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
				t.Fatalf("decode services payload: %v", err)
			}
			if payload.AgentName != "agent" || len(payload.Services) != 1 || payload.Services[0].Name != "api" {
				t.Fatalf("unexpected services payload: %+v", payload)
			}
			if payload.Capabilities.AutomaticTracing.State != capabilities.StateAvailable {
				t.Fatalf("unexpected capabilities payload: %+v", payload.Capabilities)
			}
			sawServices = true
			w.WriteHeader(http.StatusNoContent)
		default:
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
	}))
	defer server.Close()

	client := New(server.URL, "token", time.Second, server.Client())
	enrolled, err := client.Enroll(t.Context(), EnrollmentRequest{AgentName: "agent"})
	if err != nil {
		t.Fatalf("Enroll returned error: %v", err)
	}
	if enrolled.AgentID != "agent-1" {
		t.Fatalf("AgentID = %q", enrolled.AgentID)
	}
	if err := client.SendEvents(t.Context(), EventRequest{
		AgentID: "agent-1",
		Events:  []state.AuditEvent{{Type: "agent_started"}},
	}); err != nil {
		t.Fatalf("SendEvents returned error: %v", err)
	}
	if err := client.SendServices(t.Context(), ServiceSnapshotRequest{
		AgentID:   "agent-1",
		AgentName: "agent",
		Services: []ServiceSnapshot{{
			Key:       "container-1",
			Name:      "api",
			CheckType: "http",
			Endpoint:  "http://api:8080/health",
			Healthy:   true,
			Seen:      true,
		}},
		Capabilities: capabilities.Report{
			CheckedAt:        time.Now(),
			AutomaticTracing: capabilities.Status{State: capabilities.StateAvailable},
		},
	}); err != nil {
		t.Fatalf("SendServices returned error: %v", err)
	}
	if !sawAuth || !sawEvents || !sawServices {
		t.Fatalf("sawAuth=%t sawEvents=%t sawServices=%t", sawAuth, sawEvents, sawServices)
	}
}

func TestClientRequiresConfig(t *testing.T) {
	client := New("", "", time.Second, nil)
	if client.Enabled() {
		t.Fatal("client should be disabled")
	}
}
func TestClientSendOTLPLogs(t *testing.T) {
	var sawOTLP bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/otlp/v1/logs" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer token" {
			t.Fatalf("Authorization = %q", r.Header.Get("Authorization"))
		}
		if r.Header.Get("Content-Type") != "application/x-protobuf" {
			t.Fatalf("Content-Type = %q", r.Header.Get("Content-Type"))
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}
		var req collectorlogspb.ExportLogsServiceRequest
		if err := proto.Unmarshal(body, &req); err != nil {
			t.Fatalf("unmarshal OTLP logs: %v", err)
		}
		if len(req.ResourceLogs) != 1 || len(req.ResourceLogs[0].ScopeLogs) != 1 {
			t.Fatalf("unexpected resource logs: %+v", req.ResourceLogs)
		}
		resource := req.ResourceLogs[0].Resource.GetAttributes()
		if len(resource) == 0 || resource[0].GetKey() != "service.name" || resource[0].GetValue().GetStringValue() != "api" {
			t.Fatalf("unexpected resource attrs: %+v", resource)
		}
		records := req.ResourceLogs[0].ScopeLogs[0].LogRecords
		if len(records) != 1 || records[0].GetBody().GetStringValue() != "hello from docker" || records[0].GetSeverityNumber() != 9 {
			t.Fatalf("unexpected log records: %+v", records)
		}
		sawOTLP = true
		w.Header().Set("Content-Type", "application/x-protobuf")
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := New(server.URL, "token", time.Second, server.Client())
	err := client.SendOTLPLogs(t.Context(), []OTLPLogBatch{{
		ServiceName: "api",
		ContainerID: "container-1",
		Entries: []OTLPLogEntry{{
			Timestamp:      time.Date(2026, 6, 26, 1, 2, 3, 0, time.UTC),
			Body:           "hello from docker",
			SeverityText:   "INFO",
			SeverityNumber: 9,
		}},
	}})
	if err != nil {
		t.Fatalf("SendOTLPLogs returned error: %v", err)
	}
	if !sawOTLP {
		t.Fatal("server did not receive OTLP logs")
	}
}
