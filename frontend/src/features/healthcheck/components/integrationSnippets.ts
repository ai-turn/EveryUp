/**
 * Code snippet data for IntegrationPanel.
 * Extracted to reduce IntegrationPanel.tsx file size.
 */

export function buildHttpAppenderSnippets(hostname: string, port: string, isHttps: boolean, displayKey: string, ingestUrl: string): Record<string, string> {
  return {
    express: `// Express / Node.js — Winston HTTP Transport
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

// 사용 예시
logger.error('DB Connection Timeout', { orderId: '12345' });
logger.warn('Slow query detected', { duration: 3200 });`,

    springboot: `<!-- Spring Boot — Logback HTTP Appender -->
<!-- 1. pom.xml 의존성 추가 -->
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

  <appender name="MT_HTTP"
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

  <!-- WARN 이상만 HTTP 전송 -->
  <root level="WARN">
    <appender-ref ref="CONSOLE" />
    <appender-ref ref="MT_HTTP" />
  </root>
</configuration>

// @timestamp, level, message, logger_name
// 등의 Logstash 필드를 자동 인식합니다.`,

    aspnet: `// ASP.NET — Serilog HTTP Sink
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

// 사용 예시
Log.Error("DB Connection Timeout {@Details}",
    new { OrderId = "12345", Path = "/api/orders" });
Log.Warning("Slow query detected {@Details}",
    new { Duration = 3200, Query = "SELECT ..." });

// ── AuthHeaderHttpClient.cs ──
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

// Serilog Compact JSON 포맷
// (@t, @mt, @l 등)을 자동 인식합니다.`,

    fastapi: `# FastAPI / Django — Python logging HTTPHandler
# 추가 패키지 불필요 (표준 라이브러리)

import logging
import logging.handlers

# HTTPHandler는 커스텀 헤더 미지원이므로 확장 필요
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

# 사용 예시
logger.error('DB Connection Timeout')
logger.warning('Slow query detected')

# Python form-encoded 포맷
# (levelname, msg 등)을 자동 인식합니다.`,
  };
}

export function buildAgentSnippets(hostname: string, port: string, isHttps: boolean, displayKey: string, ingestUrl: string, origin: string): Record<string, string> {
  return {
    config: `# fluent-bit.conf — Fluent Bit 설정 파일
# 파일 tail → EveryUp API로 전송

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
    header          X-Log-Agent-Source agent
    header          Content-Type application/json
    tls             ${isHttps ? 'on' : 'off'}
    tls.verify      off
    retry_limit     3`,

    docker_sidecar: `# docker-compose.yml — Sidecar 패턴
# 앱과 Log Agent가 로그 볼륨을 공유합니다

services:
  myapp:
    image: myapp:latest
    volumes:
      - app-logs:/var/log/app   # 앱이 여기에 로그 파일 생성

  everyup-agent:
    image: aiturn/everyup-log-agent:latest
    volumes:
      - app-logs:/var/log/app:ro  # 컨테이너 내부 경로는 /var/log/app
    environment:
      - LOG_AGENT_ENDPOINT=${origin}
      - LOG_AGENT_API_KEY=${displayKey}
      # LOG_AGENT_FILE 기본값: /var/log/app/*.log
    restart: unless-stopped

volumes:
  app-logs:`,

    docker_pipe: `# Docker Pipe 모드
# 컨테이너 stdout/stderr를 Log Agent로 파이프

services:
  myapp:
    image: myapp:latest
    # 앱은 stdout으로 로그 출력

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
# VM/베어메탈에서 Log Agent를 systemd 서비스로 실행

[Unit]
Description=EveryUp Log Agent (Fluent Bit)
After=network.target

[Service]
Type=simple
ExecStart=/opt/fluent-bit/bin/fluent-bit \\
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

# 설치:
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

        # Authorization 헤더를 백엔드로 전달 (필수)
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
    # 외부 노출 없이 nginx와 내부 통신
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
      - ./certs:/etc/nginx/certs:ro   # HTTPS 인증서 (선택)
    depends_on:
      - everyup

# nginx.conf (위 nginx_conf 탭 참고)
# proxy_pass를 http://everyup:8080 으로 변경`,
    docker_run: `# 1. 네트워크 생성
docker network create everyup-net

# 2. 앱 컨테이너 실행
docker run -d \\
  --name everyup \\
  --network everyup-net \\
  -v everyup-data:/app/data \\
  --restart unless-stopped \\
  aiturn/everyup:latest

# 3. nginx.conf 준비 (proxy_pass: http://everyup:8080)
# proxy_set_header Authorization $http_authorization; 포함 필수

# 4. Nginx 컨테이너 실행
docker run -d \\
  --name nginx \\
  --network everyup-net \\
  -p 80:80 \\
  -v $(pwd)/nginx.conf:/etc/nginx/conf.d/default.conf:ro \\
  --restart unless-stopped \\
  nginx:alpine`,
  };
}

export function buildAgentQuickStart(displayKey: string, origin: string): string {
  return `docker run -d --name everyup-log-agent \\
  -v /path/to/your/app/logs:/var/log/app:ro \\
  -e LOG_AGENT_ENDPOINT="${origin}" \\
  -e LOG_AGENT_API_KEY="${displayKey}" \\
  --restart unless-stopped \\
  aiturn/everyup-log-agent:latest`;
}
