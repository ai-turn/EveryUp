package telemetrygateway

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

type recordingForwarder struct {
	signal string
	body   []byte
}

func (f *recordingForwarder) ForwardOTLPProtobuf(_ context.Context, signal string, data []byte) ([]byte, error) {
	f.signal = signal
	f.body = append([]byte(nil), data...)
	return []byte{9, 8, 7}, nil
}

func TestServerForwardsTraces(t *testing.T) {
	forwarder := &recordingForwarder{}
	server := New(":0", forwarder)
	handler := server.handleOTLP("traces")

	req := httptest.NewRequest(http.MethodPost, "/v1/traces", bytes.NewReader([]byte{1, 2, 3}))
	req.Header.Set("Content-Type", "application/x-protobuf")
	resp := httptest.NewRecorder()

	handler(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", resp.Code, resp.Body.String())
	}
	if forwarder.signal != "traces" || !bytes.Equal(forwarder.body, []byte{1, 2, 3}) || !bytes.Equal(resp.Body.Bytes(), []byte{9, 8, 7}) {
		t.Fatalf("forwarded signal=%q body=%v", forwarder.signal, forwarder.body)
	}
}

func TestServerRejectsNonProtobuf(t *testing.T) {
	forwarder := &recordingForwarder{}
	server := New(":0", forwarder)
	handler := server.handleOTLP("logs")

	req := httptest.NewRequest(http.MethodPost, "/v1/logs", bytes.NewReader([]byte("{}")))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	handler(resp, req)

	if resp.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("status = %d, want %d", resp.Code, http.StatusUnsupportedMediaType)
	}
}
