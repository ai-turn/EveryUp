package telemetrygateway

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"time"
)

// Forwarder sends raw OTLP/HTTP protobuf payloads to the upstream EveryUp Web.
type Forwarder interface {
	ForwardOTLPProtobuf(ctx context.Context, signal string, data []byte) ([]byte, error)
}

type Server struct {
	addr      string
	forwarder Forwarder
	server    *http.Server
}

func New(addr string, forwarder Forwarder) *Server {
	if strings.TrimSpace(addr) == "" {
		addr = ":4318"
	}
	return &Server{addr: addr, forwarder: forwarder}
}

func (s *Server) Enabled() bool {
	return s != nil && s.forwarder != nil && strings.TrimSpace(s.addr) != ""
}

func (s *Server) Run(ctx context.Context) error {
	if !s.Enabled() {
		return nil
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/logs", s.handleOTLP("logs"))
	mux.HandleFunc("/v1/traces", s.handleOTLP("traces"))
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	s.server = &http.Server{
		Addr:              s.addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = s.server.Shutdown(shutdownCtx)
	}()

	log.Printf("EveryUp telemetry gateway listening on %s", s.addr)
	err := s.server.ListenAndServe()
	if err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

func (s *Server) handleOTLP(signal string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.Header().Set("Allow", http.MethodPost)
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if !isProtobuf(r.Header.Get("Content-Type")) {
			http.Error(w, "expected application/x-protobuf", http.StatusUnsupportedMediaType)
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, 4<<20+1))
		if err != nil {
			http.Error(w, fmt.Sprintf("read OTLP body: %v", err), http.StatusBadRequest)
			return
		}
		if len(body) > 4<<20 {
			http.Error(w, "OTLP request body exceeds 4 MiB limit", http.StatusRequestEntityTooLarge)
			return
		}
		if len(body) == 0 {
			http.Error(w, "empty OTLP body", http.StatusBadRequest)
			return
		}

		upstreamBody, err := s.forwarder.ForwardOTLPProtobuf(r.Context(), signal, body)
		if err != nil {
			log.Printf("telemetry gateway forward failed: signal=%s err=%v", signal, err)
			http.Error(w, "failed to forward OTLP payload", http.StatusBadGateway)
			return
		}
		w.Header().Set("Content-Type", "application/x-protobuf")
		if len(upstreamBody) > 0 {
			_, _ = w.Write(upstreamBody)
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

func isProtobuf(contentType string) bool {
	contentType = strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	return contentType == "application/x-protobuf" || contentType == "application/protobuf"
}

func Port(addr string) string {
	_, port, err := net.SplitHostPort(addr)
	if err == nil {
		return port
	}
	if strings.HasPrefix(addr, ":") {
		return strings.TrimPrefix(addr, ":")
	}
	return ""
}
