<p align="center">
  <img src="docs/images/logo.webp" alt="EveryUp" width="88">
</p>

<h1 align="center">EveryUp</h1>

<p align="center">
  A self-hosted monitoring dashboard and lightweight Agent for Docker services.
</p>

<p align="center">
  <a href="README.ko.md">한국어</a> -
  <a href="https://ai-turn.github.io/everyup/">Live Demo</a> -
  <a href="#quick-start">Quick Start</a> -
  <a href="#api-request-monitoring-optional">API Monitoring</a> -
  <a href="#what-gets-collected">What's Collected</a>
</p>

<p align="center">
  <a href="https://ai-turn.github.io/everyup/"><img src="https://img.shields.io/badge/Demo-live-brightgreen" alt="Live demo"></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license">
  <img src="https://img.shields.io/badge/Go-1.24-00ADD8?logo=go" alt="Go 1.24">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker" alt="Docker ready">
</p>

<p align="center">
  <img src="docs/images/everyup-main-en.png" alt="EveryUp dashboard" width="100%">
</p>

## What is EveryUp?

Monitor Docker services on your own servers without standing up a large
observability stack. You get a Web dashboard for **service health, logs, API
requests, infrastructure, and alerts** — fed by one lightweight Agent per server.

- Automatic Docker container discovery — no per-service config
- stdout/stderr log collection without changing application code
- API request data (method, path, status, duration)
- Host CPU, memory, disk, and network metrics
- Telegram, Discord, and Slack notifications

EveryUp has two parts:

| Part | What it does | Where it runs |
| --- | --- | --- |
| **Web** | Dashboard, users, alert rules, notification channels, history | Your dashboard server |
| **Agent** | Docker discovery, container state, logs, host metrics | Each server you monitor |

## Quick Start

> Run **Web** once, then drop the **Agent** into the Compose stack on each server
> you want to monitor. Compose templates also live in [`web/`](web/docker-compose.yml)
> and [`agent/`](agent/docker-compose.yml).

### 1. Start Web

On the dashboard server, create `docker-compose.yml`:

```yaml
services:
  everyup:
    image: aiturn/everyup:latest
    container_name: everyup
    ports:
      - "3001:3001"
    volumes:
      - everyup-data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  everyup-data:
    driver: local
```

```bash
docker compose up -d
```

Open `http://WEB_SERVER_IP:3001` and create the first admin account.

### 2. Create an Agent key

In the dashboard, open **Services → Add** and create an Agent entry. Copy the API
key (`evup_svc_…`) shown after creation — it belongs to the Agent only.

### 3. Add the Agent to the monitored server

Add `everyup-agent` to that server's `docker-compose.yml` (next to your app
services if it already has a Compose file):

```yaml
services:
  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
    user: "0:0"
    environment:
      EVERYUP_WEB_SYNC_ENABLED: "true"
      EVERYUP_WEB_BASE_URL: "http://WEB_SERVER_IP:3001"   # reachable from this server
      EVERYUP_AGENT_API_KEY: "evup_svc_replace_me"        # key from step 2
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/hostfs:ro
      - everyup-agent-data:/data
    restart: unless-stopped

volumes:
  everyup-agent-data:
```

```bash
docker compose up -d everyup-agent
```

The Agent appears online within ~30s and automatically finds the other containers
on that host. **Container health, logs, and host metrics now flow with no
per-service configuration.** For per-request API data, see the next section.

## API Request Monitoring (optional)

Per-request data (method, path, status, duration) comes from **OpenTelemetry
auto-instrumentation** in your app, exported to the Agent's telemetry gateway
(`:4318`). It works on Linux/macOS/Windows, needs no API key in the app (the Agent
attaches its own), and captures **metadata only — no request/response bodies**.

**1. Add these env vars to your app service** (same for every language):

```yaml
environment:
  OTEL_SERVICE_NAME: demo                              # MUST match the service name shown in EveryUp
  OTEL_EXPORTER_OTLP_ENDPOINT: http://everyup-agent:4318
  OTEL_EXPORTER_OTLP_PROTOCOL: http/protobuf
  OTEL_TRACES_EXPORTER: otlp
  OTEL_METRICS_EXPORTER: none
  OTEL_LOGS_EXPORTER: none
```

**2. Enable auto-instrumentation** (no application code):

| Language | How |
| --- | --- |
| **Java** (Spring Boot, Quarkus, …) | Mount `opentelemetry-javaagent.jar`, set `JAVA_TOOL_OPTIONS=-javaagent:/otel/opentelemetry-javaagent.jar` |
| **Python** (FastAPI, Django, Flask) | `pip install opentelemetry-distro opentelemetry-exporter-otlp` → run via `opentelemetry-instrument python app.py` |
| **Node.js** (Express, NestJS, …) | `npm i @opentelemetry/auto-instrumentations-node` → set `NODE_OPTIONS=--require @opentelemetry/auto-instrumentations-node/register` |

Full compose snippets and more languages (Ruby, .NET, PHP, Go):
[docs/OTEL_API_INSTRUMENTATION.md](docs/OTEL_API_INSTRUMENTATION.md).

**3. On the Agent**, set `EVERYUP_API_CAPTURE_MODE: "otlp"` so it stops parsing
stdout access logs into requests (otherwise the same request is counted twice).

> **Link logs to a request.** Print the trace id in your logs so EveryUp's "View
> logs" button on a request finds them. For Spring Boot, add
> `LOGGING_PATTERN_LEVEL=%5p [%X{trace_id}/%X{span_id}]` — the OTel agent fills the
> MDC automatically.

## What Gets Collected

With just the Agent (steps 1–3), from the Docker socket and `/hostfs`:

| Data | Source |
| --- | --- |
| Container up/down, name, image, state, events | Docker socket |
| stdout/stderr logs | `docker logs` |
| Host CPU, memory, disk, network | `/hostfs` mount |
| API requests | Access-log lines in stdout, **or** OpenTelemetry (above) |

Logs and access-log requests are read from **stdout/stderr** — a service that
writes only to a file inside the container can't be seen this way. Write app logs
(or reverse-proxy access logs) to stdout. Access-log lines are recognized in these
shapes:

```text
10.0.0.1 - - "GET /api/users HTTP/1.1" 200 17ms
method=GET path=/api/users status=200 duration=17ms
{"method":"GET","path":"/api/users","status":200,"duration_ms":17}
```

This mode does not inspect application internals (DB queries, function names, full
traces) unless the app is instrumented with OpenTelemetry.

## Documentation

| Document | What's inside |
| --- | --- |
| [web/README.md](web/README.md) | Web setup, environment variables, API areas, local development |
| [agent/README.md](agent/README.md) | Agent setup, full environment variable reference, Compose settings |
| [docs/NOTIFICATION_SETUP.md](docs/NOTIFICATION_SETUP.md) | Telegram / Discord / Slack channel credentials and configuration ([한국어](docs/NOTIFICATION_SETUP.ko.md)) |
| [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) | Backing up and restoring the `/app/data` directory ([한국어](docs/BACKUP_RESTORE.ko.md)) |
| [docs/OTEL_API_INSTRUMENTATION.md](docs/OTEL_API_INSTRUMENTATION.md) | Per-request API capture via OpenTelemetry auto-instrumentation, per language (한국어) |
| [docs/API_REQUEST_LOGGING_GUIDE.md](docs/API_REQUEST_LOGGING_GUIDE.md) | Linking logs to API requests with `request_id` / trace id (한국어) |
| [docs/OTEL_ONLY_MIGRATION.md](docs/OTEL_ONLY_MIGRATION.md) | Logs and traces are accepted via OpenTelemetry OTLP/HTTP only |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Feature, refactor, and bugfix history (한국어) |

## Reference

**Networking** — The Agent reaches containers and logs through the mounted Docker
socket, so it works even from its own Compose project. For the cleanest setup, put
`everyup-agent` in the same Compose file as the app stack on that server.

**Repository layout**

```text
web/                       # Web — Go API + SQLite + React dashboard
  docker-compose.yml
agent/                     # Agent — Docker discovery, logs, host metrics
  docker-compose.yml
docker-compose.yml         # root convenience (Web only)
```

**Development**

```bash
cd web/backend && go test ./...     # backend tests
cd web/frontend && pnpm build       # frontend build
cd agent && go test ./...           # agent tests
```
