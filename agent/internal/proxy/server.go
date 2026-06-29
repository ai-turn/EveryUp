package proxy

import (
	"context"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"
)

type Config struct {
	ListenAddr    string
	UpstreamURL   string
	ServiceName   string
	OTLPEndpoint  string
	HTTPTimeout   time.Duration
	CaptureConfig CaptureConfig
}

type Server struct {
	cfg      Config
	upstream *url.URL
	server   *http.Server
	exporter *otlpExporter
}

type requestState struct {
	start    time.Time
	trace    traceContext
	decision captureDecision
	reqBody  bodySnapshot
}

type requestStateKey struct{}

func New(cfg Config) (*Server, error) {
	if strings.TrimSpace(cfg.ListenAddr) == "" {
		cfg.ListenAddr = ":8080"
	}
	if strings.TrimSpace(cfg.ServiceName) == "" {
		cfg.ServiceName = "everyup-proxy"
	}
	upstream, err := url.Parse(strings.TrimSpace(cfg.UpstreamURL))
	if err != nil {
		return nil, err
	}
	return &Server{
		cfg:      cfg,
		upstream: upstream,
		exporter: newOTLPExporter(cfg.OTLPEndpoint, cfg.HTTPTimeout),
	}, nil
}

func (s *Server) Run(ctx context.Context) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	mux.Handle("/", s.captureMiddleware(s.reverseProxy()))

	s.server = &http.Server{
		Addr:              s.cfg.ListenAddr,
		Handler:           recoverHandler(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = s.server.Shutdown(shutdownCtx)
	}()

	log.Printf("EveryUp proxy listening on %s upstream=%s", s.cfg.ListenAddr, s.upstream.String())
	err := s.server.ListenAndServe()
	if err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

func (s *Server) captureMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		state := &requestState{
			start:    time.Now(),
			trace:    traceContextFromHeader(r.Header.Get("traceparent")),
			decision: s.cfg.CaptureConfig.candidate(r),
		}
		r.Header.Set("traceparent", state.trace.header())
		if state.decision.candidate {
			state.reqBody, r.Body = snapshotAndRestoreBody(r.Body, s.cfg.CaptureConfig.withDefaults().MaxBodyBytes, s.cfg.CaptureConfig, r.Header.Get("Content-Type"))
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), requestStateKey{}, state)))
	})
}

func (s *Server) reverseProxy() http.Handler {
	proxy := httputil.NewSingleHostReverseProxy(s.upstream)
	originalDirector := proxy.Director
	proxy.Director = func(r *http.Request) {
		originalDirector(r)
		appendForwardedHeaders(r)
	}
	proxy.ModifyResponse = func(resp *http.Response) error {
		state, _ := resp.Request.Context().Value(requestStateKey{}).(*requestState)
		if state == nil {
			return nil
		}
		end := time.Now()
		latency := end.Sub(state.start)
		respBody := bodySnapshot{}
		keepBody := state.decision.candidate && s.cfg.CaptureConfig.shouldKeepBody(resp.StatusCode, latency)
		if keepBody && captureableEncoding(resp.Header.Get("Content-Encoding")) && captureableContentType(resp.Header.Get("Content-Type")) && !streamingResponse(resp) {
			respBody, resp.Body = snapshotAndRestoreBody(resp.Body, s.cfg.CaptureConfig.withDefaults().MaxBodyBytes, s.cfg.CaptureConfig, resp.Header.Get("Content-Type"))
		}
		exportAsync(s.exporter, s.spanPayload(resp.Request, state, resp.StatusCode, latency, state.start, end, respBody, keepBody))
		return nil
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("proxy upstream error: method=%s path=%s err=%v", r.Method, r.URL.RequestURI(), err)
		if state, _ := r.Context().Value(requestStateKey{}).(*requestState); state != nil {
			end := time.Now()
			latency := end.Sub(state.start)
			exportAsync(s.exporter, s.spanPayload(r, state, http.StatusBadGateway, latency, state.start, end, bodySnapshot{}, false))
		}
		http.Error(w, "upstream unavailable", http.StatusBadGateway)
	}
	return proxy
}

func (s *Server) spanPayload(r *http.Request, state *requestState, statusCode int, latency time.Duration, start time.Time, end time.Time, respBody bodySnapshot, keepBody bool) spanPayload {
	path := r.URL.Path
	if path == "" {
		path = "/"
	}
	return spanPayload{
		Trace:       state.trace,
		ServiceName: s.cfg.ServiceName,
		Method:      r.Method,
		Path:        path,
		StatusCode:  statusCode,
		Duration:    latency,
		Start:       start,
		End:         end,
		ClientIP:    clientIP(r.RemoteAddr),
		ReqBody:     state.reqBody,
		RespBody:    respBody,
		BodyKept:    keepBody,
	}
}

func appendForwardedHeaders(r *http.Request) {
	if r.Header.Get("X-Forwarded-Host") == "" && r.Host != "" {
		r.Header.Set("X-Forwarded-Host", r.Host)
	}
	if r.Header.Get("X-Forwarded-Proto") == "" {
		proto := "http"
		if r.TLS != nil {
			proto = "https"
		}
		r.Header.Set("X-Forwarded-Proto", proto)
	}
	if ip := clientIP(r.RemoteAddr); ip != "" {
		prior := r.Header.Get("X-Forwarded-For")
		if prior == "" {
			r.Header.Set("X-Forwarded-For", ip)
		} else {
			r.Header.Set("X-Forwarded-For", prior+", "+ip)
		}
	}
}

func clientIP(remoteAddr string) string {
	if idx := strings.LastIndex(remoteAddr, ":"); idx > -1 {
		return strings.Trim(remoteAddr[:idx], "[]")
	}
	return strings.Trim(remoteAddr, "[]")
}

func recoverHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				log.Printf("proxy recovered panic: method=%s path=%s panic=%v", r.Method, r.URL.RequestURI(), recovered)
				http.Error(w, "proxy error", http.StatusBadGateway)
			}
		}()
		next.ServeHTTP(w, r)
	})
}
