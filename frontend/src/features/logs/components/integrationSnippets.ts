/**
 * Snippet builders used by IntegrationPanel.
 * Each snippet is written to be copy-friendly for first-time setup.
 */

export function buildHttpAppenderSnippets(hostname: string, port: string, isHttps: boolean, displayKey: string, ingestUrl: string): Record<string, string> {
  return {
    express: `// Express / Node.js
// Send warn/error logs directly to EveryUp with Winston HTTP transport
// npm install winston

const winston = require('winston');

const logger = winston.createLogger({
  level: 'warn',
  transports: [
    new winston.transports.Console(),
    new winston.transports.Http({
      host: '${hostname}',
      port: ${port},
      path: '/api/v1/logs/ingest',
      ssl: ${isHttps},
      headers: { 'Authorization': 'Bearer ${displayKey}' },
    }),
  ],
});

// Example usage
logger.error('DB Connection Timeout', { orderId: '12345' });
logger.warn('Slow query detected', { duration: 3200 });`,

    springboot: `<!-- Spring Boot -->
<!-- Send warn/error logs with a Logback HTTP appender -->
<!-- 1. Add dependencies to pom.xml -->
<dependency>
  <groupId>net.logstash.logback</groupId>
  <artifactId>logstash-logback-encoder</artifactId>
  <version>7.4</version>
</dependency>
<dependency>
  <groupId>ch.qos.logback.contrib</groupId>
  <artifactId>logback-jackson</artifactId>
  <version>0.1.5</version>
</dependency>

<!-- 2. src/main/resources/logback-spring.xml -->
<configuration>
  <appender name="CONSOLE"
    class="ch.qos.logback.core.ConsoleAppender">
    <encoder>
      <pattern>%d [%level] %logger - %msg%n</pattern>
    </encoder>
  </appender>

  <appender name="EVERYUP_HTTP"
    class="net.logstash.logback.appender.LogstashHttpAppender">
    <url>${ingestUrl}</url>
    <customHeaders>
      <header>
        <name>Authorization</name>
        <value>Bearer ${displayKey}</value>
      </header>
    </customHeaders>
    <encoder class=
      "net.logstash.logback.encoder.LogstashEncoder"/>
  </appender>

  <!-- Send WARN and above to EveryUp -->
  <root level="WARN">
    <appender-ref ref="CONSOLE" />
    <appender-ref ref="EVERYUP_HTTP" />
  </root>
</configuration>

// Common Logstash fields such as
// @timestamp, level, message, logger_name
// are recognized automatically by the server.`,

    aspnet: `// ASP.NET
// Send warn/error logs directly with the Serilog HTTP sink
// dotnet add package Serilog.Sinks.Http

using Serilog;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Warning()
    .WriteTo.Console()
    .WriteTo.Http(
        requestUri: "${ingestUrl}",
        httpClient: new AuthHeaderHttpClient(
            "${displayKey}"))
    .CreateLogger();

// Example usage
Log.Error("DB Connection Timeout {@Details}",
    new { OrderId = "12345", Path = "/api/orders" });
Log.Warning("Slow query detected {@Details}",
    new { Duration = 3200, Query = "SELECT ..." });

// AuthHeaderHttpClient.cs
using Serilog.Sinks.Http;
public class AuthHeaderHttpClient : IHttpClient
{
    private readonly HttpClient _client = new();
    public AuthHeaderHttpClient(string apiKey) =>
        _client.DefaultRequestHeaders.Add(
            "Authorization", $"Bearer {apiKey}");
    public Task<HttpResponseMessage> PostAsync(
        string uri, HttpContent content) =>
        _client.PostAsync(uri, content);
    public void Dispose() => _client.Dispose();
}

// Serilog Compact JSON format
// Fields like @t, @mt, and @l
// are recognized automatically.`,

    fastapi: `# FastAPI / Django
# Send warn/error logs with Python's built-in HTTPHandler
# No extra package required (standard library only)

import logging
import logging.handlers

# HTTPHandler does not support custom headers by default,
# so we extend it to add Authorization.
class MTHandler(logging.handlers.HTTPHandler):
    def __init__(self, api_key):
        super().__init__(
            '${hostname}:${port}',
            '/api/v1/logs/ingest', method='POST',
            secure=${isHttps ? 'True' : 'False'})
        self.api_key = api_key
    def emit(self, record):
        self.headers = {
            'Authorization': f'Bearer {self.api_key}'}
        super().emit(record)

logger = logging.getLogger('myapp')
logger.setLevel(logging.WARNING)
logger.addHandler(MTHandler('${displayKey}'))
logger.addHandler(logging.StreamHandler())

# Example usage
logger.error('DB Connection Timeout')
logger.warning('Slow query detected')

# Python form-encoded payloads are also supported.
# Fields like levelname and msg are recognized automatically.`,
  };
}

export function buildAgentSnippets(hostname: string, port: string, isHttps: boolean, displayKey: string, origin: string): Record<string, string> {
  return {
    config: `# fluent-bit.conf
# Tail a log file and forward each line to EveryUp

[SERVICE]
    flush           1
    daemon          off
    log_level       info
    parsers_file    /fluent-bit/etc/parsers.conf

[INPUT]
    name            tail
    path            /var/log/app/app.log
    tag             log-agent.logs
    read_from_head  false
    refresh_interval 5
    rotate_wait     30
    skip_long_lines on
    db              /tmp/flb_tail.db

[FILTER]
    name            lua
    match           log-agent.logs
    script          /fluent-bit/etc/transform.lua
    call            transform

[OUTPUT]
    name            http
    match           log-agent.logs
    host            ${hostname}
    port            ${port}
    uri             /api/v1/logs/ingest
    format          json
    json_date_key   false
    header          Authorization Bearer ${displayKey}
    header          X-MT-Source agent
    header          Content-Type application/json
    tls             ${isHttps ? 'on' : 'off'}
    tls.verify      off
    retry_limit     3`,

    docker_sidecar: `# docker-compose.yml
# Sidecar pattern: your app and the Log Agent share one log volume

services:
  myapp:
    image: myapp:latest
    volumes:
      - app-logs:<YOUR_LOG_PATH>   # ← 앱이 로그를 쓰는 실제 경로로 교체 (예: /app/logs)

  everyup-agent:
    image: aiturn/everyup-log-agent:latest
    volumes:
      - app-logs:<YOUR_LOG_PATH>:ro  # ← 위와 동일한 경로 유지 (읽기 전용)
    environment:
      - LOG_AGENT_ENDPOINT=${origin}
      - LOG_AGENT_API_KEY=${displayKey}
      # Default LOG_AGENT_FILE is /var/log/app/*.log
    restart: unless-stopped

volumes:
  app-logs:`,

    docker_pipe: `# Docker pipe mode
# Use this when your app only writes logs to stdout/stderr

services:
  myapp:
    image: myapp:latest
    # App writes logs to stdout

  everyup-agent:
    image: aiturn/everyup-log-agent:latest
    environment:
      - LOG_AGENT_ENDPOINT=${origin}
      - LOG_AGENT_API_KEY=${displayKey}
      - LOG_AGENT_CONFIG=/fluent-bit/etc/stdin.conf
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    entrypoint: >
      sh -c "docker logs -f myapp 2>&1 |
      /entrypoint.sh"
    restart: unless-stopped`,

    systemd: `# /etc/systemd/system/everyup-log-agent.service
# Run the Log Agent on a VM or bare metal host with systemd

[Unit]
Description=EveryUp Log Agent (Fluent Bit)
After=network.target

[Service]
Type=simple
ExecStart=/opt/fluent-bit/bin/fluent-bit \
  -c /etc/everyup-agent/fluent-bit.conf
Restart=always
RestartSec=5
EnvironmentFile=/etc/everyup-agent/env

[Install]
WantedBy=multi-user.target

# --- /etc/everyup-agent/env ---
# LOG_AGENT_HOST=${hostname}
# LOG_AGENT_PORT=${port}
# LOG_AGENT_TLS=${isHttps ? 'on' : 'off'}
# LOG_AGENT_API_KEY=${displayKey}
# LOG_AGENT_FILE=/var/log/myapp/app.log
# LOG_AGENT_LEVEL=info

# Install steps:
# curl -sL https://packages.fluentbit.io/install.sh | sh
# sudo cp fluent-bit.conf /etc/everyup-agent/
# sudo systemctl enable everyup-log-agent
# sudo systemctl start everyup-log-agent`,
  };
}

export function buildNginxSnippets(hostname: string): Record<string, string> {
  return {
    nginx_conf: `server {
    listen 80;
    server_name ${hostname};

    location / {
        proxy_pass http://localhost:8080;

        # Forward the Authorization header to the app
        # This is required for log ingestion requests.
        proxy_set_header Authorization $http_authorization;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`,
    docker_compose: `# docker-compose.yml
services:
  everyup:
    image: aiturn/everyup:latest
    container_name: everyup
    restart: unless-stopped
    # Internal-only port, reached through nginx
    expose:
      - "8080"

  nginx:
    image: nginx:alpine
    container_name: nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certs:/etc/nginx/certs:ro   # Optional for HTTPS
    depends_on:
      - everyup

# nginx.conf
# Change proxy_pass to http://everyup:8080`,
    docker_run: `# 1. Create a shared network
docker network create everyup-net

# 2. Start EveryUp
docker run -d \
  --name everyup \
  --network everyup-net \
  -v everyup-data:/app/data \
  --restart unless-stopped \
  aiturn/everyup:latest

# 3. Prepare nginx.conf (proxy_pass: http://everyup:8080)
# Include: proxy_set_header Authorization $http_authorization;

# 4. Start nginx
docker run -d \
  --name nginx \
  --network everyup-net \
  -p 80:80 \
  -v $(pwd)/nginx.conf:/etc/nginx/conf.d/default.conf:ro \
  --restart unless-stopped \
  nginx:alpine`,
  };
}

export function buildApiCaptureMiddlewareSnippets(origin: string, displayKey: string): Record<string, string> {
  const endpoint = `${origin}/api/v1/ingest/requests`;
  return {
    springboot: `// EveryUpFilter.java — Spring Boot 2.x / 3.x
// 추가 의존성 없음 (spring-boot-starter-web 포함)
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.net.URI;
import java.net.http.*;

@Component
public class EveryUpFilter extends OncePerRequestFilter {
    private static final String ENDPOINT = "${endpoint}";
    private static final String API_KEY  = "${displayKey}";
    private final HttpClient http = HttpClient.newHttpClient();

    @Override
    protected void doFilterInternal(HttpServletRequest req,
            HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        long start   = System.currentTimeMillis();
        var reqWrap  = new ContentCachingRequestWrapper(req);
        var resWrap  = new ContentCachingResponseWrapper(res);
        chain.doFilter(reqWrap, resWrap);
        resWrap.copyBodyToResponse();

        String payload = """
            {"method":"%s","path":"%s","statusCode":%d,"durationMs":%d,
             "reqBody":"%s","resBody":"%s"}
            """.formatted(
                req.getMethod(), req.getRequestURI(), res.getStatus(),
                System.currentTimeMillis() - start,
                new String(reqWrap.getContentAsByteArray()).replace("\\"", "\\\\\\""),
                new String(resWrap.getContentAsByteArray()).replace("\\"", "\\\\\\""));

        http.sendAsync(
            HttpRequest.newBuilder(URI.create(ENDPOINT))
                .header("X-API-Key", API_KEY)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload)).build(),
            HttpResponse.BodyHandlers.discarding());
    }
}`,

    fastapi: `# FastAPI — BaseHTTPMiddleware
# pip install httpx
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
import httpx, time

ENDPOINT = "${endpoint}"
API_KEY  = "${displayKey}"

class EveryUpMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start    = time.monotonic()
        req_body = await request.body()
        response = await call_next(request)
        duration = int((time.monotonic() - start) * 1000)

        chunks = []
        async for chunk in response.body_iterator:
            chunks.append(chunk)
        res_body = b"".join(chunks)
        async def body_iter(): yield res_body
        response.body_iterator = body_iter()

        try:
            async with httpx.AsyncClient() as client:
                await client.post(ENDPOINT, timeout=3,
                    headers={"X-API-Key": API_KEY},
                    json={"method": request.method,
                          "path": request.url.path,
                          "statusCode": response.status_code,
                          "durationMs": duration,
                          "reqBody": req_body.decode("utf-8", errors="replace"),
                          "resBody": res_body.decode("utf-8", errors="replace")})
        except Exception:
            pass
        return response

# main.py
from fastapi import FastAPI
app = FastAPI()
app.add_middleware(EveryUpMiddleware)`,

    express: `// Express / Node.js — 미들웨어
// Node 18+ (fetch 내장) 또는: npm install node-fetch

const ENDPOINT = "${endpoint}";
const API_KEY  = "${displayKey}";

function everyUpCapture(req, res, next) {
    const start  = Date.now();
    const chunks = [];
    const _write = res.write.bind(res);
    const _end   = res.end.bind(res);

    res.write = (c, ...a) => { chunks.push(Buffer.from(c)); return _write(c, ...a); };
    res.end   = (c, ...a) => {
        if (c) chunks.push(Buffer.from(c));
        fetch(ENDPOINT, {
            method: "POST",
            headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({
                method: req.method, path: req.originalUrl,
                statusCode: res.statusCode, durationMs: Date.now() - start,
                reqBody: JSON.stringify(req.body),
                resBody: Buffer.concat(chunks).toString(),
            }),
        }).catch(() => {});
        return _end(c, ...a);
    };
    next();
}

// app.js
app.use(express.json());
app.use(everyUpCapture);`,

    go: `// Go — net/http 미들웨어
package main

import (
    "bytes"
    "encoding/json"
    "io"
    "net/http"
    "time"
)

const (
    everyUpEndpoint = "${endpoint}"
    everyUpAPIKey   = "${displayKey}"
)

type resCapture struct {
    http.ResponseWriter
    status int
    body   bytes.Buffer
}

func (r *resCapture) WriteHeader(code int) {
    r.status = code
    r.ResponseWriter.WriteHeader(code)
}
func (r *resCapture) Write(b []byte) (int, error) {
    r.body.Write(b)
    return r.ResponseWriter.Write(b)
}

func EveryUpCapture(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        reqBody, _ := io.ReadAll(r.Body)
        r.Body = io.NopCloser(bytes.NewReader(reqBody))

        rc := &resCapture{ResponseWriter: w, status: 200}
        next.ServeHTTP(rc, r)

        payload, _ := json.Marshal(map[string]any{
            "method": r.Method, "path": r.URL.Path,
            "statusCode": rc.status,
            "durationMs": time.Since(start).Milliseconds(),
            "reqBody": string(reqBody),
            "resBody": rc.body.String(),
        })
        go func() {
            req, _ := http.NewRequest("POST", everyUpEndpoint,
                bytes.NewReader(payload))
            req.Header.Set("X-API-Key", everyUpAPIKey)
            req.Header.Set("Content-Type", "application/json")
            http.DefaultClient.Do(req)
        }()
    })
}

// 사용: http.ListenAndServe(":8080", EveryUpCapture(mux))`,

    django: `# Django — MIDDLEWARE 클래스
# settings.py
# MIDDLEWARE = [
#     "myapp.middleware.EveryUpMiddleware",
#     ...
# ]

# myapp/middleware.py
import json, time, threading
import urllib.request

ENDPOINT = "${endpoint}"
API_KEY  = "${displayKey}"

class EveryUpMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start    = time.monotonic()
        req_body = request.body.decode("utf-8", errors="replace")
        response = self.get_response(request)
        duration = int((time.monotonic() - start) * 1000)

        res_body = ""
        if hasattr(response, "content"):
            res_body = response.content.decode("utf-8", errors="replace")

        payload = json.dumps({
            "method": request.method, "path": request.path,
            "statusCode": response.status_code, "durationMs": duration,
            "reqBody": req_body, "resBody": res_body,
        }).encode()

        def _send():
            try:
                req = urllib.request.Request(ENDPOINT, data=payload,
                    headers={"X-API-Key": API_KEY,
                             "Content-Type": "application/json"})
                urllib.request.urlopen(req, timeout=3)
            except Exception:
                pass
        threading.Thread(target=_send, daemon=True).start()
        return response`,
  };
}

export function buildAgentQuickStart(displayKey: string, origin: string): string {
  return `docker run -d --name everyup-log-agent \
  -v /path/to/your/app/logs:/var/log/app:ro \
  -e LOG_AGENT_ENDPOINT="${origin}" \
  -e LOG_AGENT_API_KEY="${displayKey}" \
  --restart unless-stopped \
  aiturn/everyup-log-agent:latest`;
}

export function buildAgentPullCommand(): string {
  return 'docker pull aiturn/everyup-log-agent:latest';
}

export function buildApiCaptureSnippets(origin: string, displayKey: string): Record<string, string> {
  const ingestUrl = `${origin}/api/v1/ingest/requests`;
  return {
    curl: `curl -X POST ${ingestUrl} \\
  -H "X-API-Key: ${displayKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "method": "POST",
    "path": "/api/users/42",
    "statusCode": 201,
    "durationMs": 45,
    "reqHeaders": {"Content-Type": "application/json"},
    "reqBody": "{\\"name\\":\\"Alice\\"}",
    "resBody": "{\\"id\\":42,\\"name\\":\\"Alice\\"}"
  }'`,

    express: `// Express middleware — capture API requests to EveryUp
function everyupCapture(apiKey, endpoint) {
  return (req, res, next) => {
    const start = Date.now();
    const originalJson = res.json.bind(res);
    let resBody = '';
    res.json = (body) => {
      resBody = JSON.stringify(body);
      return originalJson(body);
    };
    res.on('finish', () => {
      fetch(endpoint + '/api/v1/ingest/requests', {
        method: 'POST',
        headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Date.now() - start,
          reqBody: JSON.stringify(req.body),
          resBody,
        }),
      }).catch(() => {});
    });
    next();
  };
}
app.use(everyupCapture('${displayKey}', '${origin}'));`,

    go: `func EveryUpCaptureMiddleware(apiKey, endpoint string, next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        rw := &responseWriter{ResponseWriter: w}
        next.ServeHTTP(rw, r)
        go func() {
            payload, _ := json.Marshal(map[string]any{
                "method":     r.Method,
                "path":       r.URL.Path,
                "statusCode": rw.status,
                "durationMs": time.Since(start).Milliseconds(),
            })
            req, _ := http.NewRequest("POST", endpoint+"/api/v1/ingest/requests", bytes.NewReader(payload))
            req.Header.Set("X-API-Key", apiKey)
            req.Header.Set("Content-Type", "application/json")
            http.DefaultClient.Do(req)
        }()
    })
}`,
  };
}
