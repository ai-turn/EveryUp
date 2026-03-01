import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { MaterialIcon } from '../../../components/common';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { api, Service } from '../../../services/api';

interface IntegrationPanelProps {
  service: Service;
  onApiKeyRegenerated: (newKey: string, maskedKey: string) => void;
}

export function IntegrationPanel({ service, onApiKeyRegenerated }: IntegrationPanelProps) {
  const { t } = useTranslation();
  const { copy } = useCopyToClipboard();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealCountdown, setRevealCountdown] = useState(0);
  const [activeCategory, setActiveCategory] = useState<'http-appender' | 'agent'>('http-appender');
  const [activeSnippet, setActiveSnippet] = useState<string>('express');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maskedKey = service.apiKeyMasked || '—';
  const ingestUrl = `${window.location.origin}/api/v1/logs/ingest`;
  const displayKey = '<YOUR_API_KEY>';

  const dismissRevealedKey = useCallback(() => {
    setRevealedKey(null);
    setRevealCountdown(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Auto-close countdown for revealed key
  useEffect(() => {
    if (!revealedKey) return;
    setRevealCountdown(10);
    timerRef.current = setInterval(() => {
      setRevealCountdown((prev) => {
        if (prev <= 1) {
          dismissRevealedKey();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [revealedKey, dismissRevealedKey]);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setShowConfirm(false);
    try {
      const { apiKey: newKey, apiKeyMasked: newMasked } = await api.regenerateServiceApiKey(service.id);
      onApiKeyRegenerated(newKey, newMasked);
      setRevealedKey(newKey);
      toast.success(t('services.integration.toast.regenerated'));
    } catch {
      toast.error(t('services.integration.toast.regenerateFailed'));
    } finally {
      setIsRegenerating(false);
    }
  };

  // ── HTTP Appender Snippets ──
  const httpAppenderSnippets: Record<string, string> = {
    express: `// Express / Node.js — Winston HTTP Transport
// npm install winston

const winston = require('winston');

const logger = winston.createLogger({
  level: 'warn',
  transports: [
    new winston.transports.Console(),
    new winston.transports.Http({
      host: '${window.location.hostname}',
      port: ${window.location.port || '443'},
      path: '/api/v1/logs/ingest',
      ssl: ${window.location.protocol === 'https:'},
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
            '${window.location.hostname}:${window.location.port || '443'}',
            '/api/v1/logs/ingest', method='POST',
            secure=${window.location.protocol === 'https:' ? 'True' : 'False'})
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

  // ── Agent Snippets (Fluent Bit) ──
  const agentSnippets: Record<string, string> = {
    config: `# fluent-bit.conf — Fluent Bit 설정 파일
# 파일 tail → MT Monitoring API로 전송

[SERVICE]
    flush           1
    daemon          off
    log_level       info
    parsers_file    /fluent-bit/etc/parsers.conf

[INPUT]
    name            tail
    path            /var/log/myapp/app.log
    tag             mt.logs
    read_from_head  false
    refresh_interval 5
    rotate_wait     30
    skip_long_lines on
    db              /tmp/flb_tail.db

[FILTER]
    name            lua
    match           mt.logs
    script          /fluent-bit/etc/mt_transform.lua
    call            mt_transform

[OUTPUT]
    name            http
    match           mt.logs
    host            ${window.location.hostname}
    port            ${window.location.port || '443'}
    uri             /api/v1/logs/ingest
    format          json
    json_date_key   false
    header          Authorization Bearer ${displayKey}
    header          X-MT-Source agent
    header          Content-Type application/json
    tls             ${window.location.protocol === 'https:' ? 'on' : 'off'}
    tls.verify      off
    retry_limit     3`,

    docker_sidecar: `# docker-compose.yml — Sidecar 패턴
# 앱과 Fluent Bit Agent가 로그 볼륨을 공유합니다

services:
  myapp:
    image: myapp:latest
    volumes:
      - app-logs:/var/log/myapp

  mt-agent:
    image: ghcr.io/mt-monitoring/fluent-bit:latest
    volumes:
      - app-logs:/var/log/myapp:ro
    environment:
      MT_ENDPOINT: "${ingestUrl}"
      MT_API_KEY: "${displayKey}"
      MT_FILE: "/var/log/myapp/app.log"
    restart: unless-stopped

volumes:
  app-logs:`,

    docker_pipe: `# Docker Pipe 모드
# 컨테이너 stdout/stderr를 Fluent Bit으로 파이프

services:
  myapp:
    image: myapp:latest
    # 앱은 stdout으로 로그 출력

  mt-agent:
    image: ghcr.io/mt-monitoring/fluent-bit:latest
    environment:
      MT_ENDPOINT: "${ingestUrl}"
      MT_API_KEY: "${displayKey}"
      MT_CONFIG: "/fluent-bit/etc/stdin.conf"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    entrypoint: >
      sh -c "docker logs -f myapp 2>&1 |
      /entrypoint.sh"
    restart: unless-stopped`,

    systemd: `# /etc/systemd/system/mt-fluent-bit.service
# VM/EC2에서 Fluent Bit을 systemd 서비스로 실행

[Unit]
Description=MT Log Agent (Fluent Bit)
After=network.target

[Service]
Type=simple
ExecStart=/opt/fluent-bit/bin/fluent-bit \\
  -c /etc/mt-agent/fluent-bit.conf
Restart=always
RestartSec=5
EnvironmentFile=/etc/mt-agent/env

[Install]
WantedBy=multi-user.target

# --- /etc/mt-agent/env ---
# MT_HOST=${window.location.hostname}
# MT_PORT=${window.location.port || '443'}
# MT_TLS=${window.location.protocol === 'https:' ? 'on' : 'off'}
# MT_API_KEY=${displayKey}
# MT_FILE=/var/log/myapp/app.log
# MT_LOG_LEVEL=info

# 설치:
# curl -sL https://packages.fluentbit.io/install.sh | sh
# sudo cp fluent-bit.conf /etc/mt-agent/
# sudo systemctl enable mt-fluent-bit
# sudo systemctl start mt-fluent-bit`,
  };

  const categoryTabs = [
    { key: 'http-appender' as const, label: t('services.integration.snippets.httpAppender'), icon: 'http' },
    { key: 'agent' as const, label: t('services.integration.snippets.agent'), icon: 'smart_toy' },
  ];

  const httpAppenderTabs = [
    { key: 'express', label: 'Express / Node.js' },
    { key: 'springboot', label: 'Spring Boot' },
    { key: 'aspnet', label: 'ASP.NET' },
    { key: 'fastapi', label: 'FastAPI / Django' },
  ];

  const agentTabs = [
    { key: 'config', label: t('services.integration.snippets.agentConfig') },
    { key: 'docker_sidecar', label: 'Docker (Sidecar)' },
    { key: 'docker_pipe', label: 'Docker (Pipe)' },
    { key: 'systemd', label: 'systemd' },
  ];

  const currentTabs = activeCategory === 'http-appender' ? httpAppenderTabs : agentTabs;
  const currentSnippets = activeCategory === 'http-appender' ? httpAppenderSnippets : agentSnippets;

  // Reset snippet tab when switching category
  const handleCategoryChange = (cat: 'http-appender' | 'agent') => {
    setActiveCategory(cat);
    setActiveSnippet(cat === 'http-appender' ? 'express' : 'config');
  };

  return (
    <div className="space-y-6">
      {/* API Key Card */}
      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
            <MaterialIcon name="key" className="text-lg text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {t('services.integration.apiKey.title')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-text-muted-dark">
              {t('services.integration.apiKey.description')}
            </p>
          </div>
        </div>

        {/* Key Display */}
        <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-ui-hover-dark rounded-lg font-mono text-sm mb-4">
          <span className="flex-1 text-slate-700 dark:text-text-base-dark truncate">
            {maskedKey}
          </span>
        </div>

        {/* Warning + Regenerate */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <MaterialIcon name="warning" className="text-sm" />
            {t('services.integration.apiKey.warning')}
          </p>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={isRegenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
          >
            {isRegenerating ? (
              <MaterialIcon name="sync" className="text-sm animate-spin" />
            ) : (
              <MaterialIcon name="refresh" className="text-sm" />
            )}
            {t('services.integration.apiKey.regenerate')}
          </button>
        </div>
      </div>

      {/* Ingest Endpoint Info */}
      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30">
            <MaterialIcon name="upload" className="text-lg text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {t('services.integration.endpoint.title')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-text-muted-dark">
              {t('services.integration.endpoint.description')}
            </p>
          </div>
        </div>

        {/* Log Ingest Endpoint */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-text-muted-dark mb-1.5">
            {t('services.integration.endpoint.logIngest', { defaultValue: 'Log Ingestion' })}
          </p>
          <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-ui-hover-dark rounded-lg font-mono text-sm">
            <span className="text-xs font-bold text-white bg-green-600 px-2 py-0.5 rounded">POST</span>
            <span className="flex-1 text-slate-700 dark:text-text-base-dark truncate">{ingestUrl}</span>
            <button
              onClick={() => copy(ingestUrl)}
              className="flex-shrink-0 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors text-slate-500 dark:text-text-muted-dark"
            >
              <MaterialIcon name="content_copy" className="text-base" />
            </button>
          </div>
        </div>

        {/* Level guide */}
        <div className="grid grid-cols-2 gap-3">
          {(['error', 'warn'] as const).map((level) => (
            <div key={level} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-ui-hover-dark">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                level === 'error' ? 'bg-red-500' : 'bg-amber-500'
              }`} />
              <span className="text-xs font-mono font-semibold text-slate-700 dark:text-text-secondary-dark">{level}</span>
            </div>
          ))}
        </div>

        {/* Format auto-detection info */}
        <div className="mt-3 space-y-2">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
              <MaterialIcon name="auto_awesome" className="text-sm" />
              {t('services.integration.endpoint.formatInfo', { defaultValue: 'Send logs as-is from your logging library. No format conversion needed — the server recognizes all major formats automatically.' })}
            </p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
              <MaterialIcon name="info" className="text-sm" />
              {t('services.integration.endpoint.batchInfo', { defaultValue: 'Supports batch ingestion: send up to 100 logs per request.' })}
            </p>
          </div>
        </div>
      </div>

      {/* Connection Test */}
      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <MaterialIcon name="cable" className="text-lg text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {t('services.integration.connectionTest.title', { defaultValue: 'Connection Test' })}
            </h3>
            <p className="text-xs text-slate-500 dark:text-text-muted-dark">
              {t('services.integration.connectionTest.description', { defaultValue: 'Verify network connectivity and API key before integrating.' })}
            </p>
          </div>
        </div>

        <div className="relative">
          <pre className="p-4 bg-slate-900 dark:bg-bg-main-dark rounded-lg text-sm text-slate-200 overflow-x-auto leading-relaxed">
            <code>{`curl -X POST ${ingestUrl} \\
  -H "Authorization: Bearer ${maskedKey !== '—' ? maskedKey : displayKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"level":"info","message":"Connection test","service":"${service.id}"}'`}</code>
          </pre>
          <button
            onClick={() => copy(`curl -X POST ${ingestUrl} \\\n  -H "Authorization: Bearer ${displayKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"level":"info","message":"Connection test","service":"${service.id}"}'`)}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title={t('common.copyToClipboard')}
          >
            <MaterialIcon name="content_copy" className="text-base" />
          </button>
        </div>

        <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
          <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-1.5">
            <MaterialIcon name="check_circle" className="text-sm mt-0.5 shrink-0" />
            {t('services.integration.connectionTest.successHint', { defaultValue: 'If connected successfully, the server responds with HTTP 200. If you get a timeout or connection refused, check your firewall outbound rules and server inbound rules.' })}
          </p>
        </div>
      </div>

      {/* Code Snippets */}
      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <MaterialIcon name="code" className="text-lg text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {t('services.integration.snippets.title')}
          </h3>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 mb-4 bg-slate-100 dark:bg-ui-hover-dark p-1 rounded-lg w-fit">
          {categoryTabs.map((cat) => (
            <button
              key={cat.key}
              onClick={() => handleCategoryChange(cat.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeCategory === cat.key
                  ? 'bg-white dark:bg-ui-active-dark text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-text-muted-dark hover:text-slate-700 dark:hover:text-text-secondary-dark'
              }`}
            >
              <MaterialIcon name={cat.icon} className="text-sm" />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Method description hint */}
        <div className="mb-4 p-3 bg-slate-50 dark:bg-ui-hover-dark/50 rounded-lg">
          <p className="text-xs text-slate-600 dark:text-text-secondary-dark flex items-center gap-1.5">
            <MaterialIcon name="info" className="text-sm text-slate-400 dark:text-text-dim-dark" />
            {activeCategory === 'http-appender'
              ? t('services.integration.snippets.httpAppenderDesc', { defaultValue: 'Add a logging transport to your app code. Logs are sent directly to the API — best for applications where you control the source code.' })
              : t('services.integration.snippets.agentDesc', { defaultValue: 'Deploy a Fluent Bit agent that tails log files and forwards them. Best for servers, containers, or apps that write logs to files or stdout.' })
            }
          </p>
        </div>

        {/* Agent Quick Start — Docker install command */}
        {activeCategory === 'agent' && (
          <div className="mb-4 border border-cyan-200 dark:border-cyan-800/50 bg-cyan-50 dark:bg-cyan-900/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-800/40">
                <MaterialIcon name="deployed_code" className="text-base text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('services.integration.agent.quickStart', { defaultValue: 'Quick Start' })}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-text-muted-dark">
                  {t('services.integration.agent.quickStartDesc', { defaultValue: 'Pull and run the Log Agent with a single command.' })}
                </p>
              </div>
            </div>
            <div className="relative">
              <pre className="p-3 bg-slate-900 dark:bg-slate-950 rounded-lg text-xs text-slate-300 overflow-x-auto leading-relaxed whitespace-pre">{`docker run -d --name mt-log-agent \\
  -v /var/log/myapp:/var/log/myapp:ro \\
  -e MT_ENDPOINT="${window.location.origin}" \\
  -e MT_API_KEY="${displayKey}" \\
  -e MT_FILE="/var/log/myapp/*.log" \\
  --restart unless-stopped \\
  aiturn/mt-log-agent:latest`}</pre>
              <button
                onClick={() => copy(`docker run -d --name mt-log-agent \\\n  -v /var/log/myapp:/var/log/myapp:ro \\\n  -e MT_ENDPOINT="${window.location.origin}" \\\n  -e MT_API_KEY="${displayKey}" \\\n  -e MT_FILE="/var/log/myapp/*.log" \\\n  --restart unless-stopped \\\n  aiturn/mt-log-agent:latest`)}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-700 hover:bg-slate-600 transition-colors text-slate-300"
                title={t('services.integration.snippets.copy')}
              >
                <MaterialIcon name="content_copy" className="text-sm" />
              </button>
            </div>
          </div>
        )}

        {/* Language/variant tabs */}
        <div className="flex gap-1 mb-3 bg-slate-100 dark:bg-ui-hover-dark p-1 rounded-lg w-fit flex-wrap">
          {currentTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSnippet(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeSnippet === tab.key
                  ? 'bg-white dark:bg-ui-active-dark text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-text-muted-dark hover:text-slate-700 dark:hover:text-text-secondary-dark'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Code block */}
        <div className="relative">
          <pre className="p-4 bg-slate-900 dark:bg-slate-950 rounded-lg text-xs text-slate-300 overflow-x-auto leading-relaxed whitespace-pre">
            {currentSnippets[activeSnippet]}
          </pre>
          <button
            onClick={() => copy(currentSnippets[activeSnippet])}
            className="absolute top-3 right-3 p-1.5 rounded-md bg-slate-700 hover:bg-slate-600 transition-colors text-slate-300"
            title={t('services.integration.snippets.copy')}
          >
            <MaterialIcon name="content_copy" className="text-sm" />
          </button>
        </div>
      </div>

      {/* Regenerate Confirm Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-bg-surface-dark rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-11 h-11 rounded-full bg-red-100 dark:bg-red-900/30">
                <MaterialIcon name="warning" className="text-xl text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('services.integration.apiKey.confirmTitle')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5">
                  {t('services.integration.apiKey.confirmDesc')}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-ui-hover-dark text-slate-700 dark:text-text-secondary-dark font-semibold text-sm hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleRegenerate}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors"
              >
                {t('services.integration.apiKey.confirmAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revealed Key Modal — shown after regeneration */}
      {revealedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-bg-surface-dark rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-11 h-11 rounded-full bg-green-100 dark:bg-green-900/30">
                <MaterialIcon name="key" className="text-xl text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('services.integration.apiKey.revealTitle')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5">
                  {t('services.integration.apiKey.revealDesc')}
                </p>
              </div>
            </div>

            {/* Key display with copy */}
            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-ui-hover-dark rounded-lg font-mono text-sm mb-4">
              <span className="flex-1 text-slate-700 dark:text-text-base-dark break-all select-all">
                {revealedKey}
              </span>
              <button
                onClick={() => copy(revealedKey)}
                className="shrink-0 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors text-slate-500 dark:text-text-muted-dark"
                title={t('services.integration.apiKey.copy')}
              >
                <MaterialIcon name="content_copy" className="text-base" />
              </button>
            </div>

            <button
              onClick={dismissRevealedKey}
              className="w-full px-4 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              {t('services.integration.apiKey.revealConfirm')}
              {revealCountdown > 0 && ` (${revealCountdown}s)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
